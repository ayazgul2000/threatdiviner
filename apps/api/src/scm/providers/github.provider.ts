import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  ScmProvider,
  ScmRepository,
  ScmUser,
  ScmCommit,
  ScmBranch,
  ScmLanguages,
  ScmPullRequest,
  OAuthTokenResponse,
} from './scm-provider.interface';

@Injectable()
export class GitHubProvider implements ScmProvider {
  readonly name = 'github';
  private readonly logger = new Logger(GitHubProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly apiBaseUrl = 'https://api.github.com';

  // Cache for installation tokens (key: installationId, value: { token, expiresAt })
  private installationTokenCache = new Map<string, { token: string; expiresAt: Date }>();

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GITHUB_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET') || '';
    this.appId = this.configService.get<string>('GITHUB_APP_ID') || '';
    this.privateKey = (this.configService.get<string>('GITHUB_PRIVATE_KEY') || '').replace(/\\n/g, '\n');
  }

  /**
   * Check if GitHub App is configured
   */
  isAppConfigured(): boolean {
    return !!(this.appId && this.privateKey);
  }

  /**
   * Generate a JWT for GitHub App authentication
   */
  private generateAppJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued 60 seconds ago to account for clock drift
      exp: now + 600, // Expires in 10 minutes (max allowed)
      iss: this.appId,
    };

    // Create JWT header
    const header = { alg: 'RS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    // Sign the JWT
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(this.privateKey, 'base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Get installation ID for a repository
   */
  async getInstallationId(owner: string, repo: string): Promise<string | null> {
    if (!this.isAppConfigured()) {
      return null;
    }

    try {
      const jwt = this.generateAppJwt();
      const response = await fetch(`${this.apiBaseUrl}/repos/${owner}/${repo}/installation`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${jwt}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Failed to get installation for ${owner}/${repo}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return String(data.id);
    } catch (error) {
      this.logger.error(`Error getting installation ID: ${error}`);
      return null;
    }
  }

  /**
   * Get an installation access token for GitHub App operations
   */
  async getInstallationToken(installationId: string): Promise<string | null> {
    if (!this.isAppConfigured()) {
      this.logger.warn('GitHub App not configured (missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY)');
      return null;
    }

    // Check cache first
    const cached = this.installationTokenCache.get(installationId);
    if (cached && cached.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
      // Token is valid for at least 5 more minutes
      return cached.token;
    }

    try {
      const jwt = this.generateAppJwt();
      const response = await fetch(
        `${this.apiBaseUrl}/app/installations/${installationId}/access_tokens`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${jwt}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to get installation token: ${response.status} ${error}`);
        return null;
      }

      const data = await response.json();
      const token = data.token;
      const expiresAt = new Date(data.expires_at);

      // Cache the token
      this.installationTokenCache.set(installationId, { token, expiresAt });
      this.logger.log(`Obtained installation token for installation ${installationId}`);

      return token;
    } catch (error) {
      this.logger.error(`Error getting installation token: ${error}`);
      return null;
    }
  }

  /**
   * Get an App token for a specific repository (gets installation ID then token)
   */
  async getAppTokenForRepo(owner: string, repo: string): Promise<string | null> {
    const installationId = await this.getInstallationId(owner, repo);
    if (!installationId) {
      return null;
    }
    return this.getInstallationToken(installationId);
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'repo read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`GitHub OAuth error: ${error}`);
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scope: (data.scope || '').split(',').filter(Boolean),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scope: (data.scope || '').split(',').filter(Boolean),
    };
  }

  async getCurrentUser(accessToken: string): Promise<ScmUser> {
    const response = await this.apiRequest(accessToken, '/user');
    return {
      id: String(response.id),
      login: response.login,
      name: response.name,
      email: response.email,
      avatarUrl: response.avatar_url,
    };
  }

  async listRepositories(accessToken: string, page = 1, perPage = 100): Promise<ScmRepository[]> {
    const response = await this.apiRequest(
      accessToken,
      `/user/repos?page=${page}&per_page=${perPage}&sort=updated&affiliation=owner,collaborator,organization_member`,
    );

    return response.map((repo: any) => this.mapRepository(repo));
  }

  async getRepository(accessToken: string, owner: string, repo: string): Promise<ScmRepository> {
    const response = await this.apiRequest(accessToken, `/repos/${owner}/${repo}`);
    return this.mapRepository(response);
  }

  async getBranches(accessToken: string, owner: string, repo: string): Promise<ScmBranch[]> {
    const [branches, repoInfo] = await Promise.all([
      this.apiRequest(accessToken, `/repos/${owner}/${repo}/branches?per_page=100`),
      this.apiRequest(accessToken, `/repos/${owner}/${repo}`),
    ]);

    const defaultBranch = repoInfo.default_branch;

    return branches.map((branch: any) => ({
      name: branch.name,
      sha: branch.commit.sha,
      isDefault: branch.name === defaultBranch,
      isProtected: branch.protected || false,
    }));
  }

  async getLanguages(accessToken: string, owner: string, repo: string): Promise<ScmLanguages> {
    const response = await this.apiRequest(accessToken, `/repos/${owner}/${repo}/languages`);
    return response as ScmLanguages;
  }

  async getLatestCommit(accessToken: string, owner: string, repo: string, branch: string): Promise<ScmCommit> {
    const response = await this.apiRequest(accessToken, `/repos/${owner}/${repo}/commits/${branch}`);
    return {
      sha: response.sha,
      message: response.commit.message,
      author: {
        name: response.commit.author.name,
        email: response.commit.author.email,
      },
      timestamp: new Date(response.commit.author.date),
    };
  }

  async createWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    webhookUrl: string,
    secret: string,
  ): Promise<string> {
    const response = await this.apiRequest(accessToken, `/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push', 'pull_request'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret,
          insecure_ssl: '0',
        },
      }),
    });

    return String(response.id);
  }

  async deleteWebhook(accessToken: string, owner: string, repo: string, hookId: string): Promise<void> {
    await this.apiRequest(accessToken, `/repos/${owner}/${repo}/hooks/${hookId}`, {
      method: 'DELETE',
    });
  }

  async createCheckRun(
    accessToken: string,
    owner: string,
    repo: string,
    sha: string,
    name: string,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required',
    output?: { title: string; summary: string; text?: string },
  ): Promise<string> {
    // Check Runs require GitHub App authentication
    // Try to get an App token, fall back to provided token (will likely fail for non-App tokens)
    const appToken = await this.getAppTokenForRepo(owner, repo);
    const tokenToUse = appToken || accessToken;

    if (!appToken) {
      this.logger.warn('No GitHub App token available for check run - using OAuth token (may fail)');
    }

    const body: any = {
      name,
      head_sha: sha,
      status,
    };

    if (status === 'completed' && conclusion) {
      body.conclusion = conclusion;
      body.completed_at = new Date().toISOString();
    }

    if (output) {
      body.output = output;
    }

    const response = await this.apiRequest(tokenToUse, `/repos/${owner}/${repo}/check-runs`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return String(response.id);
  }

  async updateCheckRun(
    accessToken: string,
    owner: string,
    repo: string,
    checkRunId: string,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required',
    output?: { title: string; summary: string; text?: string },
  ): Promise<void> {
    // Check Runs require GitHub App authentication
    const appToken = await this.getAppTokenForRepo(owner, repo);
    const tokenToUse = appToken || accessToken;

    const body: any = { status };

    if (status === 'completed' && conclusion) {
      body.conclusion = conclusion;
      body.completed_at = new Date().toISOString();
    }

    if (output) {
      body.output = output;
    }

    await this.apiRequest(tokenToUse, `/repos/${owner}/${repo}/check-runs/${checkRunId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  /**
   * Update check run with annotations for inline findings
   */
  async updateCheckRunWithAnnotations(
    accessToken: string,
    owner: string,
    repo: string,
    checkRunId: string,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?: 'success' | 'failure' | 'neutral',
    output?: {
      title: string;
      summary: string;
      text?: string;
      annotations?: Array<{
        path: string;
        start_line: number;
        end_line: number;
        annotation_level: 'notice' | 'warning' | 'failure';
        title: string;
        message: string;
        raw_details?: string;
      }>;
    },
  ): Promise<void> {
    // Check Runs require GitHub App authentication
    const appToken = await this.getAppTokenForRepo(owner, repo);
    const tokenToUse = appToken || accessToken;

    const body: any = { status };

    if (status === 'completed' && conclusion) {
      body.conclusion = conclusion;
      body.completed_at = new Date().toISOString();
    }

    if (output) {
      body.output = output;
    }

    await this.apiRequest(tokenToUse, `/repos/${owner}/${repo}/check-runs/${checkRunId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  /**
   * Create a PR review comment (inline comment on a diff)
   */
  async createPRReviewComment(
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number,
    commitSha: string,
    path: string,
    line: number,
    body: string,
    side: 'LEFT' | 'RIGHT' = 'RIGHT',
  ): Promise<string> {
    const response = await this.apiRequest(
      accessToken,
      `/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({
          body,
          commit_id: commitSha,
          path,
          line,
          side,
        }),
      },
    );

    return String(response.id);
  }

  /**
   * Create a general PR comment (not inline)
   */
  async createPRComment(
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
  ): Promise<string> {
    const response = await this.apiRequest(
      accessToken,
      `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      },
    );

    return String(response.id);
  }

  /**
   * Get the list of files changed in a PR
   */
  async getPRFiles(
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<Array<{ filename: string; status: string; additions: number; deletions: number }>> {
    const response = await this.apiRequest(
      accessToken,
      `/repos/${owner}/${repo}/pulls/${prNumber}/files`,
    );

    return response.map((file: any) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
    }));
  }

  /**
   * Get the raw diff for a pull request
   * Returns unified diff format
   */
  async getPullRequestDiff(
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number | string,
  ): Promise<string> {
    const url = `${this.apiBaseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3.diff',
        'Authorization': `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`GitHub API error getting PR diff: ${response.status} ${error}`);
      throw new Error(`Failed to get PR diff: ${response.status}`);
    }

    return response.text();
  }

  /**
   * Get the raw diff between two branches/refs
   * Returns unified diff format
   */
  async getBranchDiff(
    accessToken: string,
    owner: string,
    repo: string,
    baseBranch: string,
    headBranch: string,
  ): Promise<string> {
    // GitHub compare API: GET /repos/{owner}/{repo}/compare/{base}...{head}
    const url = `${this.apiBaseUrl}/repos/${owner}/${repo}/compare/${baseBranch}...${headBranch}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3.diff',
        'Authorization': `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`GitHub API error getting branch diff: ${response.status} ${error}`);
      throw new Error(`Failed to get branch diff: ${response.status}`);
    }

    return response.text();
  }

  /**
   * Create a PR review with multiple comments
   */
  async createPRReview(
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number,
    commitSha: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
    body: string,
    comments?: Array<{
      path: string;
      line: number;
      body: string;
      side?: 'LEFT' | 'RIGHT';
    }>,
  ): Promise<string> {
    const reviewBody: any = {
      commit_id: commitSha,
      event,
      body,
    };

    if (comments && comments.length > 0) {
      reviewBody.comments = comments.map(c => ({
        path: c.path,
        line: c.line,
        body: c.body,
        side: c.side || 'RIGHT',
      }));
    }

    const response = await this.apiRequest(
      accessToken,
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      {
        method: 'POST',
        body: JSON.stringify(reviewBody),
      },
    );

    return String(response.id);
  }

  /**
   * Upload SARIF file to GitHub Code Scanning
   * This allows findings to appear in the Security tab of the repository
   */
  async uploadSarif(
    accessToken: string,
    owner: string,
    repo: string,
    commitSha: string,
    ref: string,
    sarifContent: string,
  ): Promise<{ id: string; url: string }> {
    // GitHub requires SARIF to be gzipped and base64 encoded
    const zlib = await import('zlib');
    const gzipped = zlib.gzipSync(Buffer.from(sarifContent, 'utf-8'));
    const encoded = gzipped.toString('base64');

    const response = await this.apiRequest(
      accessToken,
      `/repos/${owner}/${repo}/code-scanning/sarifs`,
      {
        method: 'POST',
        body: JSON.stringify({
          commit_sha: commitSha,
          ref: ref.startsWith('refs/') ? ref : `refs/heads/${ref}`,
          sarif: encoded,
          tool_name: 'ThreatDiviner',
        }),
      },
    );

    return {
      id: response.id,
      url: response.url || `https://github.com/${owner}/${repo}/security/code-scanning`,
    };
  }

  /**
   * Get Code Scanning analysis status
   */
  async getCodeScanningAnalysis(
    accessToken: string,
    owner: string,
    repo: string,
    sarifId: string,
  ): Promise<{ state: string; results_count: number }> {
    const response = await this.apiRequest(
      accessToken,
      `/repos/${owner}/${repo}/code-scanning/sarifs/${sarifId}`,
    );

    return {
      state: response.processing_status,
      results_count: response.analyses_url ? 1 : 0,
    };
  }

  /**
   * List Code Scanning alerts
   */
  async listCodeScanningAlerts(
    accessToken: string,
    owner: string,
    repo: string,
    ref?: string,
  ): Promise<Array<{
    number: number;
    rule: { id: string; severity: string };
    state: string;
    most_recent_instance: { location: { path: string; start_line: number } };
  }>> {
    const params = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const response = await this.apiRequest(
      accessToken,
      `/repos/${owner}/${repo}/code-scanning/alerts${params}`,
    );

    return response;
  }

  /**
   * Create a PR review comment with a suggestion block
   * This allows users to apply the fix with one click in GitHub UI
   *
   * For multi-line suggestions:
   * - Use start_line and line to specify the range
   * - The suggestion block replaces all lines from start_line to line
   */
  async createPRSuggestionComment(
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number,
    commitSha: string,
    path: string,
    startLine: number,
    endLine: number,
    suggestedCode: string,
    title: string,
    severity: string,
    explanation: string,
    confidence: number,
    source: string,
  ): Promise<string> {
    // Format the comment with GitHub suggestion block
    const severityEmoji: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      info: '⚪',
    };
    const emoji = severityEmoji[severity.toLowerCase()] || '⚪';
    const confidencePercent = Math.round(confidence * 100);

    const body = `### ${emoji} ThreatDiviner Security Fix

**${severity.toUpperCase()}**: ${title}
**Confidence**: ${confidencePercent}% | **Source**: ${source}

\`\`\`suggestion
${suggestedCode}
\`\`\`

<details>
<summary>Why this fix?</summary>

${explanation}

</details>

${confidence < 0.8 ? '⚠️ *AI-generated fix – please review carefully.*' : ''}`;

    // For multi-line suggestions, we need to use start_line and line
    const requestBody: Record<string, unknown> = {
      body,
      commit_id: commitSha,
      path,
      side: 'RIGHT',
    };

    if (startLine !== endLine) {
      // Multi-line comment
      requestBody.start_line = startLine;
      requestBody.line = endLine;
    } else {
      // Single-line comment
      requestBody.line = startLine;
    }

    const response = await this.apiRequest(
      accessToken,
      `/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      },
    );

    return String(response.id);
  }

  /**
   * Get file content from repository
   */
  async getFileContent(
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    ref: string,
  ): Promise<{ content: string; sha: string }> {
    const response = await this.apiRequest(
      accessToken,
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
    );

    const content = Buffer.from(response.content, 'base64').toString('utf-8');
    return {
      content,
      sha: response.sha,
    };
  }

  async getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50,
  ): Promise<ScmPullRequest[]> {
    const ghState = state === 'merged' ? 'closed' : state === 'all' ? 'all' : state;
    const perPage = Math.min(limit, 100);
    const response = await this.apiRequest(
      accessToken,
      `/repos/${owner}/${repo}/pulls?state=${ghState}&per_page=${perPage}&sort=updated&direction=desc`,
    );
    return response
      .filter((pr: any) => state !== 'merged' || pr.merged_at)
      .slice(0, limit)
      .map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        state: pr.merged_at ? 'merged' : pr.state,
        htmlUrl: pr.html_url,
        headSha: pr.head.sha,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
      }));
  }

  getAuthenticatedCloneUrl(accessToken: string, cloneUrl: string): string {
    // Convert https://github.com/owner/repo.git to https://x-access-token:TOKEN@github.com/owner/repo.git
    const url = new URL(cloneUrl);
    url.username = 'x-access-token';
    url.password = accessToken;
    return url.toString();
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !signature.startsWith('sha256=')) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    const actualSignature = signature.slice(7); // Remove 'sha256=' prefix

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(actualSignature, 'hex'),
    );
  }

  private mapRepository(repo: any): ScmRepository {
    return {
      id: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      cloneUrl: repo.clone_url,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch || 'main',
      language: repo.language,
      isPrivate: repo.private,
    };
  }

  private async apiRequest(accessToken: string, path: string, options?: RequestInit): Promise<any> {
    const url = path.startsWith('http') ? path : `${this.apiBaseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`GitHub API error: ${response.status} ${error}`);
      throw new Error(`GitHub API error: ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }
}
