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
  OAuthTokenResponse,
} from './scm-provider.interface';

@Injectable()
export class GitLabProvider implements ScmProvider {
  readonly name = 'gitlab';
  private readonly logger = new Logger(GitLabProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly gitlabUrl: string;
  private readonly apiBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GITLAB_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('GITLAB_CLIENT_SECRET') || '';
    this.gitlabUrl = this.configService.get<string>('GITLAB_URL') || 'https://gitlab.com';
    this.apiBaseUrl = `${this.gitlabUrl}/api/v4`;
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'api read_user read_repository write_repository',
      state,
    });
    return `${this.gitlabUrl}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const response = await fetch(`${this.gitlabUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`GitLab OAuth error: ${error}`);
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
      scope: (data.scope || '').split(' ').filter(Boolean),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const response = await fetch(`${this.gitlabUrl}/oauth/token`, {
      method: 'POST',
      headers: {
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
      scope: (data.scope || '').split(' ').filter(Boolean),
    };
  }

  async getCurrentUser(accessToken: string): Promise<ScmUser> {
    const response = await this.apiRequest(accessToken, '/user');
    return {
      id: String(response.id),
      login: response.username,
      name: response.name,
      email: response.email,
      avatarUrl: response.avatar_url,
    };
  }

  async listRepositories(accessToken: string, page = 1, perPage = 100): Promise<ScmRepository[]> {
    const response = await this.apiRequest(
      accessToken,
      `/projects?membership=true&per_page=${perPage}&page=${page}&order_by=updated_at`,
    );

    return response.map((repo: any) => this.mapRepository(repo));
  }

  async getRepository(accessToken: string, owner: string, repo: string): Promise<ScmRepository> {
    // GitLab uses URL-encoded project path
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const response = await this.apiRequest(accessToken, `/projects/${projectPath}`);
    return this.mapRepository(response);
  }

  async getBranches(accessToken: string, owner: string, repo: string): Promise<ScmBranch[]> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const [branches, project] = await Promise.all([
      this.apiRequest(accessToken, `/projects/${projectPath}/repository/branches?per_page=100`),
      this.apiRequest(accessToken, `/projects/${projectPath}`),
    ]);

    const defaultBranch = project.default_branch;

    return branches.map((branch: any) => ({
      name: branch.name,
      sha: branch.commit.id,
      isDefault: branch.name === defaultBranch,
      isProtected: branch.protected || false,
    }));
  }

  async getLanguages(accessToken: string, owner: string, repo: string): Promise<ScmLanguages> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const response = await this.apiRequest(accessToken, `/projects/${projectPath}/languages`);
    // GitLab returns percentages, convert to bytes (estimate based on 1000000 total)
    const totalBytes = 1000000;
    const languages: ScmLanguages = {};
    for (const [lang, percentage] of Object.entries(response)) {
      languages[lang] = Math.round((percentage as number) / 100 * totalBytes);
    }
    return languages;
  }

  async getLatestCommit(accessToken: string, owner: string, repo: string, branch: string): Promise<ScmCommit> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const response = await this.apiRequest(
      accessToken,
      `/projects/${projectPath}/repository/commits/${encodeURIComponent(branch)}`,
    );
    return {
      sha: response.id,
      message: response.message,
      author: {
        name: response.author_name,
        email: response.author_email,
      },
      timestamp: new Date(response.committed_date),
    };
  }

  async createWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    webhookUrl: string,
    secret: string,
  ): Promise<string> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const response = await this.apiRequest(accessToken, `/projects/${projectPath}/hooks`, {
      method: 'POST',
      body: JSON.stringify({
        url: webhookUrl,
        token: secret,
        push_events: true,
        merge_requests_events: true,
        enable_ssl_verification: true,
      }),
    });

    return String(response.id);
  }

  async deleteWebhook(accessToken: string, owner: string, repo: string, hookId: string): Promise<void> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    await this.apiRequest(accessToken, `/projects/${projectPath}/hooks/${hookId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Create a pipeline (commit status)
   */
  async createCommitStatus(
    accessToken: string,
    owner: string,
    repo: string,
    sha: string,
    state: 'pending' | 'running' | 'success' | 'failed' | 'canceled',
    name: string,
    targetUrl?: string,
    description?: string,
  ): Promise<void> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    await this.apiRequest(accessToken, `/projects/${projectPath}/statuses/${sha}`, {
      method: 'POST',
      body: JSON.stringify({
        state,
        name,
        target_url: targetUrl,
        description,
      }),
    });
  }

  /**
   * Create a merge request note (comment)
   */
  async createMRNote(
    accessToken: string,
    owner: string,
    repo: string,
    mrIid: number,
    body: string,
  ): Promise<string> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const response = await this.apiRequest(
      accessToken,
      `/projects/${projectPath}/merge_requests/${mrIid}/notes`,
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      },
    );
    return String(response.id);
  }

  /**
   * Create a merge request discussion (inline comment)
   */
  async createMRDiscussion(
    accessToken: string,
    owner: string,
    repo: string,
    mrIid: number,
    body: string,
    position?: {
      baseSha: string;
      headSha: string;
      startSha: string;
      newPath: string;
      newLine: number;
    },
  ): Promise<string> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const discussionBody: any = { body };

    if (position) {
      discussionBody.position = {
        base_sha: position.baseSha,
        head_sha: position.headSha,
        start_sha: position.startSha,
        position_type: 'text',
        new_path: position.newPath,
        new_line: position.newLine,
      };
    }

    const response = await this.apiRequest(
      accessToken,
      `/projects/${projectPath}/merge_requests/${mrIid}/discussions`,
      {
        method: 'POST',
        body: JSON.stringify(discussionBody),
      },
    );
    return String(response.id);
  }

  /**
   * Get merge request diff files
   */
  async getMRFiles(
    accessToken: string,
    owner: string,
    repo: string,
    mrIid: number,
  ): Promise<Array<{ new_path: string; old_path: string; new_file: boolean; deleted_file: boolean }>> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const response = await this.apiRequest(
      accessToken,
      `/projects/${projectPath}/merge_requests/${mrIid}/diffs`,
    );
    return response.map((f: any) => ({
      new_path: f.new_path,
      old_path: f.old_path,
      new_file: f.new_file,
      deleted_file: f.deleted_file,
    }));
  }

  getAuthenticatedCloneUrl(accessToken: string, cloneUrl: string): string {
    // Convert https://gitlab.com/owner/repo.git to https://oauth2:TOKEN@gitlab.com/owner/repo.git
    const url = new URL(cloneUrl);
    url.username = 'oauth2';
    url.password = accessToken;
    return url.toString();
  }

  verifyWebhookSignature(_payload: string, signature: string, secret: string): boolean {
    // GitLab uses X-Gitlab-Token header with the raw secret
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(secret),
    );
  }

  /**
   * Create a "check run" - for GitLab, we use commit statuses
   */
  async createCheckRun(
    accessToken: string,
    owner: string,
    repo: string,
    sha: string,
    name: string,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required',
    _output?: { title: string; summary: string; text?: string },
  ): Promise<string> {
    // Map to GitLab commit status states
    let gitlabState: 'pending' | 'running' | 'success' | 'failed' | 'canceled' = 'pending';
    if (status === 'in_progress') {
      gitlabState = 'running';
    } else if (status === 'completed') {
      if (conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped') {
        gitlabState = 'success';
      } else if (conclusion === 'cancelled') {
        gitlabState = 'canceled';
      } else {
        gitlabState = 'failed';
      }
    }

    await this.createCommitStatus(accessToken, owner, repo, sha, gitlabState, name);
    // Return a pseudo ID since GitLab commit statuses don't have IDs
    return `gitlab-status-${sha}-${name}`;
  }

  /**
   * Update a "check run" - for GitLab, we create a new commit status
   */
  async updateCheckRun(
    accessToken: string,
    owner: string,
    repo: string,
    _checkRunId: string,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required',
    output?: { title: string; summary: string; text?: string },
  ): Promise<void> {
    // For GitLab, we need the SHA and name from the checkRunId
    // Format: gitlab-status-{sha}-{name}
    const parts = _checkRunId.split('-');
    if (parts.length < 4 || parts[0] !== 'gitlab' || parts[1] !== 'status') {
      this.logger.warn(`Invalid GitLab check run ID: ${_checkRunId}`);
      return;
    }
    const sha = parts[2];
    const name = parts.slice(3).join('-');

    let gitlabState: 'pending' | 'running' | 'success' | 'failed' | 'canceled' = 'pending';
    if (status === 'in_progress') {
      gitlabState = 'running';
    } else if (status === 'completed') {
      if (conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped') {
        gitlabState = 'success';
      } else if (conclusion === 'cancelled') {
        gitlabState = 'canceled';
      } else {
        gitlabState = 'failed';
      }
    }

    await this.createCommitStatus(
      accessToken,
      owner,
      repo,
      sha,
      gitlabState,
      name,
      undefined,
      output?.summary,
    );
  }

  /**
   * Upload SARIF file as a SAST report to GitLab
   * GitLab doesn't have a direct SARIF upload API like GitHub.
   * Instead, we convert SARIF to GitLab SAST format and upload as a report.
   * For proper integration, this should be done via GitLab CI artifacts.
   */
  async uploadSarif(
    accessToken: string,
    owner: string,
    repo: string,
    commitSha: string,
    _ref: string,
    sarifContent: string,
  ): Promise<{ id: string; url: string }> {
    // Convert SARIF to GitLab SAST format
    const sarif = JSON.parse(sarifContent);
    const gitlabReport = this.convertSarifToGitLabSast(sarif, commitSha);

    // GitLab doesn't have a direct API for uploading security reports outside CI
    // The best approach is to create a vulnerability finding for each issue
    // Using the Vulnerability Export/Import API (requires Ultimate)

    // For now, we'll create an issue/note with the findings summary
    // In production, this should integrate with GitLab CI artifacts
    const summary = this.generateSarifSummary(sarif);

    // Create a commit status with a link
    await this.createCommitStatus(
      accessToken,
      owner,
      repo,
      commitSha,
      gitlabReport.vulnerabilities.length > 0 ? 'failed' : 'success',
      'ThreatDiviner Security Scan',
      `https://gitlab.com/${owner}/${repo}/-/security/vulnerability_report`,
      summary,
    );

    return {
      id: `gitlab-sarif-${commitSha}`,
      url: `https://gitlab.com/${owner}/${repo}/-/security/vulnerability_report`,
    };
  }

  /**
   * Convert SARIF format to GitLab SAST report format
   */
  private convertSarifToGitLabSast(sarif: any, _commitSha: string): {
    version: string;
    vulnerabilities: Array<{
      id: string;
      category: string;
      name: string;
      message: string;
      description: string;
      severity: string;
      confidence: string;
      location: { file: string; start_line: number; end_line: number };
      identifiers: Array<{ type: string; name: string; value: string }>;
    }>;
    scan: { scanner: { id: string; name: string; vendor: { name: string } }; start_time: string; end_time: string; status: string };
  } {
    const vulnerabilities: any[] = [];

    for (const run of sarif.runs || []) {
      for (const result of run.results || []) {
        const location = result.locations?.[0]?.physicalLocation;
        const severity = this.mapSarifLevelToGitLabSeverity(result.level);

        vulnerabilities.push({
          id: result.fingerprints?.['finding-id'] || `vuln-${vulnerabilities.length}`,
          category: 'sast',
          name: result.ruleId || 'Unknown',
          message: result.message?.text || 'Security issue detected',
          description: result.message?.text || '',
          severity,
          confidence: 'High',
          location: {
            file: location?.artifactLocation?.uri || '',
            start_line: location?.region?.startLine || 1,
            end_line: location?.region?.endLine || location?.region?.startLine || 1,
          },
          identifiers: [
            {
              type: 'threatdiviner_rule_id',
              name: result.ruleId || 'unknown',
              value: result.ruleId || 'unknown',
            },
          ],
        });
      }
    }

    return {
      version: '14.0.0',
      vulnerabilities,
      scan: {
        scanner: {
          id: 'threatdiviner',
          name: 'ThreatDiviner',
          vendor: { name: 'ThreatDiviner' },
        },
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        status: 'success',
      },
    };
  }

  private mapSarifLevelToGitLabSeverity(level: string): string {
    switch (level) {
      case 'error': return 'Critical';
      case 'warning': return 'Medium';
      case 'note': return 'Low';
      default: return 'Info';
    }
  }

  private generateSarifSummary(sarif: any): string {
    let critical = 0, high = 0, medium = 0, low = 0;

    for (const run of sarif.runs || []) {
      for (const result of run.results || []) {
        const level = result.level || 'warning';
        if (level === 'error') critical++;
        else if (level === 'warning') high++;
        else if (level === 'note') medium++;
        else low++;
      }
    }

    const total = critical + high + medium + low;
    if (total === 0) {
      return 'No security issues found';
    }

    return `Found ${total} issues: ${critical} critical, ${high} high, ${medium} medium, ${low} low`;
  }

  private mapRepository(repo: any): ScmRepository {
    return {
      id: String(repo.id),
      name: repo.name,
      fullName: repo.path_with_namespace,
      cloneUrl: repo.http_url_to_repo,
      htmlUrl: repo.web_url,
      defaultBranch: repo.default_branch || 'main',
      language: null, // GitLab doesn't return this in the same way
      isPrivate: repo.visibility !== 'public',
    };
  }

  private async apiRequest(accessToken: string, path: string, options?: RequestInit): Promise<any> {
    const url = path.startsWith('http') ? path : `${this.apiBaseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`GitLab API error: ${response.status} ${error}`);
      throw new Error(`GitLab API error: ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }
}
