import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ScmProvider,
  ScmRepository,
  ScmUser,
  ScmCommit,
  ScmBranch,
  ScmLanguages,
  OAuthTokenResponse,
} from './scm-provider.interface';

@Injectable()
export class BitbucketProvider implements ScmProvider {
  readonly name = 'bitbucket';
  private readonly logger = new Logger(BitbucketProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiBaseUrl = 'https://api.bitbucket.org/2.0';
  private readonly authBaseUrl = 'https://bitbucket.org';

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('BITBUCKET_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('BITBUCKET_CLIENT_SECRET') || '';
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    return `${this.authBaseUrl}/site/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(`${this.authBaseUrl}/site/oauth2/access_token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Bitbucket OAuth error: ${error}`);
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
      scope: (data.scopes || '').split(' ').filter(Boolean),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(`${this.authBaseUrl}/site/oauth2/access_token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
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
      scope: (data.scopes || '').split(' ').filter(Boolean),
    };
  }

  async getCurrentUser(accessToken: string): Promise<ScmUser> {
    const response = await this.apiRequest(accessToken, '/user');
    return {
      id: response.uuid,
      login: response.username,
      name: response.display_name,
      email: null, // Email requires separate endpoint
      avatarUrl: response.links?.avatar?.href || null,
    };
  }

  async listRepositories(accessToken: string, page = 1, perPage = 100): Promise<ScmRepository[]> {
    // Get user's workspaces first
    const user = await this.getCurrentUser(accessToken);
    const response = await this.apiRequest(
      accessToken,
      `/repositories/${user.login}?page=${page}&pagelen=${perPage}`,
    );

    return (response.values || []).map((repo: any) => this.mapRepository(repo));
  }

  async getRepository(accessToken: string, owner: string, repo: string): Promise<ScmRepository> {
    const response = await this.apiRequest(accessToken, `/repositories/${owner}/${repo}`);
    return this.mapRepository(response);
  }

  async getBranches(accessToken: string, owner: string, repo: string): Promise<ScmBranch[]> {
    const [branchesResponse, repoInfo] = await Promise.all([
      this.apiRequest(accessToken, `/repositories/${owner}/${repo}/refs/branches?pagelen=100`),
      this.apiRequest(accessToken, `/repositories/${owner}/${repo}`),
    ]);

    const defaultBranch = repoInfo.mainbranch?.name || 'main';

    return (branchesResponse.values || []).map((branch: any) => ({
      name: branch.name,
      sha: branch.target?.hash || '',
      isDefault: branch.name === defaultBranch,
      isProtected: false, // Bitbucket uses branch restrictions
    }));
  }

  async getLanguages(accessToken: string, owner: string, repo: string): Promise<ScmLanguages> {
    // Bitbucket doesn't have a dedicated languages endpoint
    // Return an estimate based on repository language
    const repoInfo = await this.apiRequest(accessToken, `/repositories/${owner}/${repo}`);
    const languages: ScmLanguages = {};
    if (repoInfo.language) {
      languages[repoInfo.language] = 100000;
    }
    return languages;
  }

  async getLatestCommit(accessToken: string, owner: string, repo: string, branch: string): Promise<ScmCommit> {
    const response = await this.apiRequest(
      accessToken,
      `/repositories/${owner}/${repo}/commits/${encodeURIComponent(branch)}?pagelen=1`,
    );

    const commit = response.values?.[0];
    if (!commit) {
      throw new Error(`No commits found for branch ${branch}`);
    }

    return {
      sha: commit.hash,
      message: commit.message,
      author: {
        name: commit.author?.raw?.split('<')[0]?.trim() || 'Unknown',
        email: commit.author?.raw?.match(/<(.+)>/)?.[1] || '',
      },
      timestamp: new Date(commit.date),
    };
  }

  async createWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    webhookUrl: string,
    _secret: string,
  ): Promise<string> {
    const response = await this.apiRequest(
      accessToken,
      `/repositories/${owner}/${repo}/hooks`,
      {
        method: 'POST',
        body: JSON.stringify({
          description: 'ThreatDiviner Security Scanner',
          url: webhookUrl,
          active: true,
          events: [
            'repo:push',
            'pullrequest:created',
            'pullrequest:updated',
          ],
        }),
      },
    );

    return response.uuid;
  }

  async deleteWebhook(accessToken: string, owner: string, repo: string, hookId: string): Promise<void> {
    await this.apiRequest(
      accessToken,
      `/repositories/${owner}/${repo}/hooks/${hookId}`,
      { method: 'DELETE' },
    );
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
    // Bitbucket uses build statuses instead of check runs
    let state: 'INPROGRESS' | 'SUCCESSFUL' | 'FAILED' | 'STOPPED' = 'INPROGRESS';

    if (status === 'queued') {
      state = 'INPROGRESS';
    } else if (status === 'in_progress') {
      state = 'INPROGRESS';
    } else if (status === 'completed') {
      if (conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped') {
        state = 'SUCCESSFUL';
      } else if (conclusion === 'cancelled') {
        state = 'STOPPED';
      } else {
        state = 'FAILED';
      }
    }

    const key = `threatdiviner-${name.toLowerCase().replace(/\s+/g, '-')}`;

    await this.apiRequest(
      accessToken,
      `/repositories/${owner}/${repo}/commit/${sha}/statuses/build`,
      {
        method: 'POST',
        body: JSON.stringify({
          state,
          key,
          name,
          description: output?.summary || `ThreatDiviner: ${name}`,
        }),
      },
    );

    return `bitbucket-status-${sha}-${key}`;
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
    // Parse the check run ID
    const parts = checkRunId.split('-');
    if (parts.length < 4 || parts[0] !== 'bitbucket' || parts[1] !== 'status') {
      this.logger.warn(`Invalid Bitbucket check run ID: ${checkRunId}`);
      return;
    }
    const sha = parts[2];
    const key = parts.slice(3).join('-');

    let state: 'INPROGRESS' | 'SUCCESSFUL' | 'FAILED' | 'STOPPED' = 'INPROGRESS';

    if (status === 'completed') {
      if (conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped') {
        state = 'SUCCESSFUL';
      } else if (conclusion === 'cancelled') {
        state = 'STOPPED';
      } else {
        state = 'FAILED';
      }
    }

    await this.apiRequest(
      accessToken,
      `/repositories/${owner}/${repo}/commit/${sha}/statuses/build`,
      {
        method: 'POST',
        body: JSON.stringify({
          state,
          key,
          description: output?.summary || 'ThreatDiviner Security Scan',
        }),
      },
    );
  }

  /**
   * Create a PR comment
   */
  async createPRComment(
    accessToken: string,
    owner: string,
    repo: string,
    prId: number,
    body: string,
  ): Promise<string> {
    const response = await this.apiRequest(
      accessToken,
      `/repositories/${owner}/${repo}/pullrequests/${prId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: { raw: body },
        }),
      },
    );

    return String(response.id);
  }

  /**
   * Create an inline PR comment
   */
  async createInlinePRComment(
    accessToken: string,
    owner: string,
    repo: string,
    prId: number,
    filePath: string,
    line: number,
    body: string,
  ): Promise<string> {
    const response = await this.apiRequest(
      accessToken,
      `/repositories/${owner}/${repo}/pullrequests/${prId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: { raw: body },
          inline: {
            path: filePath,
            to: line,
          },
        }),
      },
    );

    return String(response.id);
  }

  /**
   * Get PR files
   */
  async getPRFiles(
    accessToken: string,
    owner: string,
    repo: string,
    prId: number,
  ): Promise<Array<{ filename: string; status: string }>> {
    const response = await this.apiRequest(
      accessToken,
      `/repositories/${owner}/${repo}/pullrequests/${prId}/diffstat`,
    );

    return (response.values || []).map((file: any) => ({
      filename: file.new?.path || file.old?.path || '',
      status: file.status || 'modified',
    }));
  }

  /**
   * Create Code Insights report (for annotations)
   */
  async createCodeInsightsReport(
    accessToken: string,
    owner: string,
    repo: string,
    commitSha: string,
    annotations: Array<{
      path: string;
      line: number;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      message: string;
      externalId?: string;
    }>,
  ): Promise<{ reportId: string }> {
    const reportId = 'threatdiviner';
    const hasIssues = annotations.length > 0;

    // Create the report
    await this.apiRequest(
      accessToken,
      `/repositories/${owner}/${repo}/commit/${commitSha}/reports/${reportId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          title: 'ThreatDiviner Security Scan',
          details: `Found ${annotations.length} security issue(s)`,
          report_type: 'SECURITY',
          reporter: 'ThreatDiviner',
          result: hasIssues ? 'FAILED' : 'PASSED',
          data: [
            { title: 'Total Issues', type: 'NUMBER', value: annotations.length },
            { title: 'Critical', type: 'NUMBER', value: annotations.filter(a => a.severity === 'CRITICAL').length },
            { title: 'High', type: 'NUMBER', value: annotations.filter(a => a.severity === 'HIGH').length },
          ],
        }),
      },
    );

    // Add annotations
    if (annotations.length > 0) {
      // Bitbucket allows up to 100 annotations per request
      for (let i = 0; i < annotations.length; i += 100) {
        const batch = annotations.slice(i, i + 100);
        await this.apiRequest(
          accessToken,
          `/repositories/${owner}/${repo}/commit/${commitSha}/reports/${reportId}/annotations`,
          {
            method: 'POST',
            body: JSON.stringify(batch.map((a, idx) => ({
              external_id: a.externalId || `finding-${i + idx}`,
              annotation_type: 'VULNERABILITY',
              path: a.path,
              line: a.line,
              summary: a.message,
              severity: a.severity,
            }))),
          },
        );
      }
    }

    return { reportId };
  }

  /**
   * Upload SARIF-like report via Code Insights
   * Bitbucket doesn't support SARIF directly, so we use Code Insights API
   */
  async uploadSarif(
    accessToken: string,
    owner: string,
    repo: string,
    commitSha: string,
    _ref: string,
    sarifContent: string,
  ): Promise<{ id: string; url: string }> {
    const sarif = JSON.parse(sarifContent);
    const annotations: Array<{
      path: string;
      line: number;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      message: string;
      externalId?: string;
    }> = [];

    // Convert SARIF to annotations
    for (const run of sarif.runs || []) {
      for (const result of run.results || []) {
        const location = result.locations?.[0]?.physicalLocation;
        if (!location) continue;

        annotations.push({
          path: location.artifactLocation?.uri || '',
          line: location.region?.startLine || 1,
          severity: this.mapSarifLevelToBitbucketSeverity(result.level),
          message: result.message?.text || result.ruleId || 'Security issue',
          externalId: result.fingerprints?.['finding-id'],
        });
      }
    }

    await this.createCodeInsightsReport(accessToken, owner, repo, commitSha, annotations);

    return {
      id: `bitbucket-insights-${commitSha}`,
      url: `https://bitbucket.org/${owner}/${repo}/addon/com.atlassian.bitbucket.commit/reports/${commitSha}/threatdiviner`,
    };
  }

  private mapSarifLevelToBitbucketSeverity(level: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    switch (level) {
      case 'error': return 'CRITICAL';
      case 'warning': return 'MEDIUM';
      case 'note': return 'LOW';
      default: return 'LOW';
    }
  }

  getAuthenticatedCloneUrl(accessToken: string, cloneUrl: string): string {
    const url = new URL(cloneUrl);
    url.username = 'x-token-auth';
    url.password = accessToken;
    return url.toString();
  }

  verifyWebhookSignature(_payload: string, _signature: string, _secret: string): boolean {
    // Bitbucket webhooks don't support signature verification in the same way
    // They use IP whitelisting instead
    // For now, we return true and recommend IP whitelisting
    this.logger.warn('Bitbucket webhook signature verification not supported. Use IP whitelisting.');
    return true;
  }

  private mapRepository(repo: any): ScmRepository {
    const httpsClone = repo.links?.clone?.find((c: any) => c.name === 'https');

    return {
      id: repo.uuid,
      name: repo.name,
      fullName: repo.full_name,
      cloneUrl: httpsClone?.href || repo.links?.clone?.[0]?.href || '',
      htmlUrl: repo.links?.html?.href || `https://bitbucket.org/${repo.full_name}`,
      defaultBranch: repo.mainbranch?.name || 'main',
      language: repo.language || null,
      isPrivate: repo.is_private || false,
    };
  }

  private async apiRequest(accessToken: string, path: string, options?: RequestInit): Promise<any> {
    const url = path.startsWith('http') ? path : `${this.apiBaseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Bitbucket API error: ${response.status} ${error}`);
      throw new Error(`Bitbucket API error: ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }
}
