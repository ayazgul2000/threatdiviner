import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface ApiConfig {
  apiUrl: string;
  apiKey: string | null;
}

interface RepoInfo {
  repository: string;
  branch: string;
  commitSha: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.threatdiviner');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function getApiConfig(options: any): ApiConfig {
  // Check CLI options first
  let apiUrl = options.apiUrl || process.env.THREATDIVINER_API_URL;
  let apiKey = options.apiKey || process.env.THREATDIVINER_API_KEY;

  // Try to load from config file
  if (!apiUrl || !apiKey) {
    const savedConfig = loadSavedConfig();
    apiUrl = apiUrl || savedConfig.apiUrl;
    apiKey = apiKey || savedConfig.apiKey;
  }

  return {
    apiUrl: apiUrl || 'https://api.threatdiviner.io',
    apiKey: apiKey || null,
  };
}

export function saveApiConfig(config: Partial<ApiConfig>): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const existing = loadSavedConfig();
  const updated = { ...existing, ...config };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
}

function loadSavedConfig(): Partial<ApiConfig> {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function getRepoInfo(options: any): Promise<RepoInfo> {
  let repository = options.repository;
  let branch = options.branch;
  let commitSha = options.commit;

  // Try to detect from git
  if (!repository || !branch || !commitSha) {
    try {
      const gitInfo = getGitInfo();
      repository = repository || gitInfo.repository;
      branch = branch || gitInfo.branch;
      commitSha = commitSha || gitInfo.commitSha;
    } catch {
      // Git not available or not in a repo
    }
  }

  // Check CI environment variables
  if (!repository || !branch || !commitSha) {
    const ciInfo = getCIInfo();
    repository = repository || ciInfo.repository;
    branch = branch || ciInfo.branch;
    commitSha = commitSha || ciInfo.commitSha;
  }

  return {
    repository: repository || 'unknown',
    branch: branch || 'unknown',
    commitSha: commitSha || 'unknown',
  };
}

function getGitInfo(): RepoInfo {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();

  // Try to get remote URL
  let repository = 'unknown';
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    repository = parseGitUrl(remoteUrl);
  } catch {
    // No remote configured
  }

  return { repository, branch, commitSha };
}

function parseGitUrl(url: string): string {
  // Parse GitHub/GitLab/Bitbucket URLs
  // https://github.com/owner/repo.git
  // git@github.com:owner/repo.git

  const httpsMatch = url.match(/https?:\/\/[^/]+\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return httpsMatch[1];
  }

  const sshMatch = url.match(/git@[^:]+:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return sshMatch[1];
  }

  return url;
}

function getCIInfo(): Partial<RepoInfo> {
  // GitHub Actions
  if (process.env.GITHUB_ACTIONS) {
    return {
      repository: process.env.GITHUB_REPOSITORY,
      branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME,
      commitSha: process.env.GITHUB_SHA,
    };
  }

  // GitLab CI
  if (process.env.GITLAB_CI) {
    return {
      repository: process.env.CI_PROJECT_PATH,
      branch: process.env.CI_COMMIT_REF_NAME,
      commitSha: process.env.CI_COMMIT_SHA,
    };
  }

  // Bitbucket Pipelines
  if (process.env.BITBUCKET_BUILD_NUMBER) {
    return {
      repository: process.env.BITBUCKET_REPO_FULL_NAME,
      branch: process.env.BITBUCKET_BRANCH,
      commitSha: process.env.BITBUCKET_COMMIT,
    };
  }

  // Azure DevOps
  if (process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI) {
    return {
      repository: process.env.BUILD_REPOSITORY_NAME,
      branch: process.env.BUILD_SOURCEBRANCH?.replace('refs/heads/', ''),
      commitSha: process.env.BUILD_SOURCEVERSION,
    };
  }

  // CircleCI
  if (process.env.CIRCLECI) {
    return {
      repository: `${process.env.CIRCLE_PROJECT_USERNAME}/${process.env.CIRCLE_PROJECT_REPONAME}`,
      branch: process.env.CIRCLE_BRANCH,
      commitSha: process.env.CIRCLE_SHA1,
    };
  }

  // Jenkins
  if (process.env.JENKINS_URL) {
    return {
      repository: process.env.GIT_URL?.replace(/\.git$/, '').split('/').slice(-2).join('/'),
      branch: process.env.GIT_BRANCH?.replace('origin/', ''),
      commitSha: process.env.GIT_COMMIT,
    };
  }

  return {};
}
