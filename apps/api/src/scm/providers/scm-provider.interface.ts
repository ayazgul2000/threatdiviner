export interface ScmRepository {
  id: string;
  name: string;
  fullName: string;
  cloneUrl: string;
  htmlUrl: string;
  defaultBranch: string;
  language: string | null;
  isPrivate: boolean;
}

export interface ScmUser {
  id: string;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface ScmCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  timestamp: Date;
}

export interface ScmPullRequest {
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
  headSha: string;
  baseBranch: string;
  headBranch: string;
}

export interface ScmBranch {
  name: string;
  sha: string;
  isDefault: boolean;
  isProtected: boolean;
}

export interface ScmLanguages {
  [language: string]: number; // language -> bytes of code
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope: string[];
}

export interface ScmProvider {
  readonly name: string;

  // OAuth flow
  getOAuthUrl(state: string, redirectUri: string): string;
  exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse>;

  // User info
  getCurrentUser(accessToken: string): Promise<ScmUser>;

  // Repository operations
  listRepositories(accessToken: string, page?: number, perPage?: number): Promise<ScmRepository[]>;
  getRepository(accessToken: string, owner: string, repo: string): Promise<ScmRepository>;

  // Branch/commit operations
  getBranches(accessToken: string, owner: string, repo: string): Promise<ScmBranch[]>;
  getLatestCommit(accessToken: string, owner: string, repo: string, branch: string): Promise<ScmCommit>;
  getLanguages(accessToken: string, owner: string, repo: string): Promise<ScmLanguages>;

  // Webhook operations
  createWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    webhookUrl: string,
    secret: string,
  ): Promise<string>;
  deleteWebhook(accessToken: string, owner: string, repo: string, hookId: string): Promise<void>;

  // PR status updates
  createCheckRun(
    accessToken: string,
    owner: string,
    repo: string,
    sha: string,
    name: string,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required',
    output?: { title: string; summary: string; text?: string },
  ): Promise<string>;

  updateCheckRun(
    accessToken: string,
    owner: string,
    repo: string,
    checkRunId: string,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required',
    output?: { title: string; summary: string; text?: string },
  ): Promise<void>;

  // Clone URL with auth
  getAuthenticatedCloneUrl(accessToken: string, cloneUrl: string): string;

  // Webhook signature verification
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
}
