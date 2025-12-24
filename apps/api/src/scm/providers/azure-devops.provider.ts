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
export class AzureDevOpsProvider implements ScmProvider {
  readonly name = 'azure-devops';
  private readonly logger = new Logger(AzureDevOpsProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly organizationUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('AZURE_DEVOPS_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('AZURE_DEVOPS_CLIENT_SECRET') || '';
    this.organizationUrl = this.configService.get<string>('AZURE_DEVOPS_ORG_URL') || '';
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'Assertion',
      state,
      scope: 'vso.code_write vso.code_status vso.build_execute vso.project_read',
    });
    return `https://app.vssps.visualstudio.com/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const response = await fetch('https://app.vssps.visualstudio.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: this.clientSecret,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Azure DevOps OAuth error: ${error}`);
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
    const response = await fetch('https://app.vssps.visualstudio.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: this.clientSecret,
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
      scope: (data.scope || '').split(' ').filter(Boolean),
    };
  }

  async getCurrentUser(accessToken: string): Promise<ScmUser> {
    const response = await this.apiRequest(
      accessToken,
      'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.0',
    );

    return {
      id: response.id,
      login: response.emailAddress?.split('@')[0] || response.displayName,
      name: response.displayName,
      email: response.emailAddress,
      avatarUrl: null,
    };
  }

  async listRepositories(accessToken: string, _page = 1, _perPage = 100): Promise<ScmRepository[]> {
    if (!this.organizationUrl) {
      throw new Error('AZURE_DEVOPS_ORG_URL not configured');
    }

    // List all projects first
    const projectsResponse = await this.apiRequest(
      accessToken,
      `${this.organizationUrl}/_apis/projects?api-version=7.0`,
    );

    const repos: ScmRepository[] = [];

    // Get repositories for each project
    for (const project of projectsResponse.value || []) {
      try {
        const reposResponse = await this.apiRequest(
          accessToken,
          `${this.organizationUrl}/${project.name}/_apis/git/repositories?api-version=7.0`,
        );

        for (const repo of reposResponse.value || []) {
          repos.push(this.mapRepository(repo, project.name));
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch repos for project ${project.name}:`, err);
      }
    }

    return repos;
  }

  async getRepository(accessToken: string, owner: string, repo: string): Promise<ScmRepository> {
    // In Azure DevOps, owner is the project name
    const response = await this.apiRequest(
      accessToken,
      `${this.organizationUrl}/${owner}/_apis/git/repositories/${repo}?api-version=7.0`,
    );

    return this.mapRepository(response, owner);
  }

  async getBranches(accessToken: string, owner: string, repo: string): Promise<ScmBranch[]> {
    const [branchesResponse, repoInfo] = await Promise.all([
      this.apiRequest(
        accessToken,
        `${this.organizationUrl}/${owner}/_apis/git/repositories/${repo}/refs?filter=heads/&api-version=7.0`,
      ),
      this.getRepository(accessToken, owner, repo),
    ]);

    const defaultBranch = repoInfo.defaultBranch.replace('refs/heads/', '');

    return (branchesResponse.value || []).map((branch: any) => {
      const name = branch.name.replace('refs/heads/', '');
      return {
        name,
        sha: branch.objectId,
        isDefault: name === defaultBranch,
        isProtected: false,
      };
    });
  }

  async getLanguages(_accessToken: string, owner: string, repo: string): Promise<ScmLanguages> {
    // Azure DevOps doesn't have a built-in language detection API
    // Return empty object
    this.logger.debug(`Language detection not supported for ${owner}/${repo}`);
    return {};
  }

  async getLatestCommit(accessToken: string, owner: string, repo: string, branch: string): Promise<ScmCommit> {
    const response = await this.apiRequest(
      accessToken,
      `${this.organizationUrl}/${owner}/_apis/git/repositories/${repo}/commits?searchCriteria.itemVersion.version=${encodeURIComponent(branch)}&$top=1&api-version=7.0`,
    );

    const commit = response.value?.[0];
    if (!commit) {
      throw new Error(`No commits found for branch ${branch}`);
    }

    return {
      sha: commit.commitId,
      message: commit.comment,
      author: {
        name: commit.author?.name || 'Unknown',
        email: commit.author?.email || '',
      },
      timestamp: new Date(commit.author?.date || commit.push?.date),
    };
  }

  async createWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    webhookUrl: string,
    _secret: string,
  ): Promise<string> {
    // Azure DevOps uses service hooks
    const response = await this.apiRequest(
      accessToken,
      `${this.organizationUrl}/_apis/hooks/subscriptions?api-version=7.0`,
      {
        method: 'POST',
        body: JSON.stringify({
          publisherId: 'tfs',
          eventType: 'git.push',
          resourceVersion: '1.0',
          consumerId: 'webHooks',
          consumerActionId: 'httpRequest',
          publisherInputs: {
            projectId: owner,
            repository: repo,
          },
          consumerInputs: {
            url: webhookUrl,
          },
        }),
      },
    );

    return response.id;
  }

  async deleteWebhook(accessToken: string, _owner: string, _repo: string, hookId: string): Promise<void> {
    await this.apiRequest(
      accessToken,
      `${this.organizationUrl}/_apis/hooks/subscriptions/${hookId}?api-version=7.0`,
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
    // Map to Azure DevOps git status states
    let state: 'notSet' | 'pending' | 'succeeded' | 'failed' | 'error' = 'pending';

    if (status === 'queued' || status === 'in_progress') {
      state = 'pending';
    } else if (status === 'completed') {
      if (conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped') {
        state = 'succeeded';
      } else if (conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'action_required') {
        state = 'failed';
      } else {
        state = 'error';
      }
    }

    await this.apiRequest(
      accessToken,
      `${this.organizationUrl}/${owner}/_apis/git/repositories/${repo}/commits/${sha}/statuses?api-version=7.0`,
      {
        method: 'POST',
        body: JSON.stringify({
          state,
          description: output?.summary || `ThreatDiviner: ${name}`,
          context: {
            name: 'ThreatDiviner',
            genre: 'security',
          },
        }),
      },
    );

    return `azdo-status-${sha}-threatdiviner`;
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
    if (parts.length < 3 || parts[0] !== 'azdo') {
      this.logger.warn(`Invalid Azure DevOps check run ID: ${checkRunId}`);
      return;
    }
    const sha = parts[2];

    let state: 'notSet' | 'pending' | 'succeeded' | 'failed' | 'error' = 'pending';

    if (status === 'completed') {
      if (conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped') {
        state = 'succeeded';
      } else {
        state = 'failed';
      }
    }

    await this.apiRequest(
      accessToken,
      `${this.organizationUrl}/${owner}/_apis/git/repositories/${repo}/commits/${sha}/statuses?api-version=7.0`,
      {
        method: 'POST',
        body: JSON.stringify({
          state,
          description: output?.summary || 'ThreatDiviner Security Scan',
          context: {
            name: 'ThreatDiviner',
            genre: 'security',
          },
        }),
      },
    );
  }

  /**
   * Create a PR thread (comment)
   */
  async createPRThread(
    accessToken: string,
    owner: string,
    repo: string,
    prId: number,
    body: string,
    filePath?: string,
    line?: number,
  ): Promise<string> {
    const thread: any = {
      comments: [{ content: body, commentType: 1 }],
      status: 1, // Active
    };

    if (filePath && line) {
      thread.threadContext = {
        filePath: `/${filePath}`,
        rightFileStart: { line, offset: 1 },
        rightFileEnd: { line, offset: 1 },
      };
    }

    const response = await this.apiRequest(
      accessToken,
      `${this.organizationUrl}/${owner}/_apis/git/repositories/${repo}/pullRequests/${prId}/threads?api-version=7.0`,
      {
        method: 'POST',
        body: JSON.stringify(thread),
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
  ): Promise<Array<{ path: string; changeType: string }>> {
    const response = await this.apiRequest(
      accessToken,
      `${this.organizationUrl}/${owner}/_apis/git/repositories/${repo}/pullRequests/${prId}/iterations?api-version=7.0`,
    );

    const iterations = response.value || [];
    if (iterations.length === 0) return [];

    const latestIteration = iterations[iterations.length - 1];
    const changesResponse = await this.apiRequest(
      accessToken,
      `${this.organizationUrl}/${owner}/_apis/git/repositories/${repo}/pullRequests/${prId}/iterations/${latestIteration.id}/changes?api-version=7.0`,
    );

    return (changesResponse.changeEntries || []).map((change: any) => ({
      path: change.item?.path || '',
      changeType: change.changeType,
    }));
  }

  /**
   * Upload SARIF - Azure DevOps doesn't have native SARIF support
   * We create a status with summary instead
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
    const summary = this.generateSarifSummary(sarif);

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
    const state = total > 0 && (critical > 0 || high > 0) ? 'failed' : 'succeeded';

    await this.apiRequest(
      accessToken,
      `${this.organizationUrl}/${owner}/_apis/git/repositories/${repo}/commits/${commitSha}/statuses?api-version=7.0`,
      {
        method: 'POST',
        body: JSON.stringify({
          state,
          description: summary,
          context: {
            name: 'ThreatDiviner',
            genre: 'security',
          },
        }),
      },
    );

    return {
      id: `azdo-sarif-${commitSha}`,
      url: `${this.organizationUrl}/${owner}/_git/${repo}/commit/${commitSha}`,
    };
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

  getAuthenticatedCloneUrl(accessToken: string, cloneUrl: string): string {
    // Azure DevOps requires Basic auth with empty username
    const url = new URL(cloneUrl);
    url.username = '';
    url.password = accessToken;
    return url.toString();
  }

  verifyWebhookSignature(_payload: string, _signature: string, _secret: string): boolean {
    // Azure DevOps service hooks use different authentication
    // Typically via Basic auth or Azure AD
    this.logger.warn('Azure DevOps webhook signature verification uses different mechanism');
    return true;
  }

  private mapRepository(repo: any, projectName: string): ScmRepository {
    return {
      id: repo.id,
      name: repo.name,
      fullName: `${projectName}/${repo.name}`,
      cloneUrl: repo.remoteUrl,
      htmlUrl: repo.webUrl,
      defaultBranch: (repo.defaultBranch || 'refs/heads/main').replace('refs/heads/', ''),
      language: null,
      isPrivate: true, // Azure DevOps repos are typically private
    };
  }

  private async apiRequest(accessToken: string, url: string, options?: RequestInit): Promise<any> {
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
      this.logger.error(`Azure DevOps API error: ${response.status} ${error}`);
      throw new Error(`Azure DevOps API error: ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }
}
