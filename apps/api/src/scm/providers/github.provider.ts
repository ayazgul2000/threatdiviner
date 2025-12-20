import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  ScmProvider,
  ScmRepository,
  ScmUser,
  ScmCommit,
  OAuthTokenResponse,
} from './scm-provider.interface';

@Injectable()
export class GitHubProvider implements ScmProvider {
  readonly name = 'github';
  private readonly logger = new Logger(GitHubProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiBaseUrl = 'https://api.github.com';

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GITHUB_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET') || '';
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

    const response = await this.apiRequest(accessToken, `/repos/${owner}/${repo}/check-runs`, {
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
    const body: any = { status };

    if (status === 'completed' && conclusion) {
      body.conclusion = conclusion;
      body.completed_at = new Date().toISOString();
    }

    if (output) {
      body.output = output;
    }

    await this.apiRequest(accessToken, `/repos/${owner}/${repo}/check-runs/${checkRunId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
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
