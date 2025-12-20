import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface CloneOptions {
  url: string;
  workDir: string;
  accessToken?: string;
  branch?: string;
  depth?: number;
  timeout?: number;
}

export interface LanguageStats {
  primary: string;
  languages: Record<string, number>;
  hasDockerfile: boolean;
  hasKubernetes: boolean;
  hasTerraform: boolean;
  hasCloudFormation: boolean;
}

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);
  private readonly baseWorkDir: string;

  constructor(private readonly configService: ConfigService) {
    this.baseWorkDir = this.configService.get('SCAN_WORKDIR', path.join(os.tmpdir(), 'threatdiviner-scans'));
  }

  async createWorkDir(scanId: string): Promise<string> {
    const workDir = path.join(this.baseWorkDir, scanId);

    // Clean up any existing directory from failed scans
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    await fs.mkdir(workDir, { recursive: true });
    return workDir;
  }

  async clone(options: CloneOptions): Promise<string> {
    const { url, workDir, accessToken, branch, depth = 1, timeout = 300000 } = options;

    // Build authenticated URL if token provided
    let cloneUrl = url;
    if (accessToken) {
      const urlObj = new URL(url);
      urlObj.username = 'x-access-token';
      urlObj.password = accessToken;
      cloneUrl = urlObj.toString();
    }

    // Build git clone command
    const args = ['clone', '--single-branch'];

    if (depth) {
      args.push('--depth', String(depth));
    }

    if (branch) {
      args.push('--branch', branch);
    }

    args.push(cloneUrl, workDir);

    this.logger.log(`Cloning repository to ${workDir}`);

    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', args, {
        timeout,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0', // Disable prompts
        },
      });

      let stderr = '';

      gitProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          this.logger.log(`Clone completed: ${workDir}`);
          resolve(workDir);
        } else {
          // Sanitize error message (remove token from URL)
          const sanitizedError = stderr.replace(/x-access-token:[^@]+@/g, 'x-access-token:***@');
          this.logger.error(`Clone failed: ${sanitizedError}`);
          reject(new Error(`Clone failed with code ${code}: ${sanitizedError}`));
        }
      });

      gitProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async checkout(workDir: string, commitSha: string): Promise<void> {
    this.logger.log(`Checking out commit ${commitSha}`);
    await execAsync(`git checkout ${commitSha}`, { cwd: workDir });
  }

  async getChangedFiles(workDir: string, baseSha: string, headSha: string): Promise<string[]> {
    const { stdout } = await execAsync(
      `git diff --name-only ${baseSha}...${headSha}`,
      { cwd: workDir },
    );
    return stdout.trim().split('\n').filter(Boolean);
  }

  async getFileContent(workDir: string, filePath: string, commitSha?: string): Promise<string> {
    if (commitSha) {
      const { stdout } = await execAsync(
        `git show ${commitSha}:${filePath}`,
        { cwd: workDir },
      );
      return stdout;
    }
    return fs.readFile(path.join(workDir, filePath), 'utf-8');
  }

  async commitExists(workDir: string, commitSha: string): Promise<boolean> {
    try {
      await execAsync(`git cat-file -t ${commitSha}`, { cwd: workDir });
      return true;
    } catch {
      return false;
    }
  }

  async detectLanguages(workDir: string): Promise<LanguageStats> {
    const stats: LanguageStats = {
      primary: 'unknown',
      languages: {},
      hasDockerfile: false,
      hasKubernetes: false,
      hasTerraform: false,
      hasCloudFormation: false,
    };

    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.java': 'java',
      '.kt': 'kotlin',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'csharp',
      '.rs': 'rust',
      '.swift': 'swift',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.sql': 'sql',
      '.sh': 'bash',
    };


    try {
      // Use git ls-files to get tracked files
      const { stdout } = await execAsync('git ls-files', { cwd: workDir });
      const files = stdout.trim().split('\n').filter(Boolean);

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const basename = path.basename(file).toLowerCase();

        // Check for language
        if (languageMap[ext]) {
          const lang = languageMap[ext];
          stats.languages[lang] = (stats.languages[lang] || 0) + 1;
        }

        // Check for infrastructure files
        if (ext === '.tf') {
          stats.hasTerraform = true;
        }

        if (basename === 'dockerfile' || basename.startsWith('dockerfile.')) {
          stats.hasDockerfile = true;
        }

        if (ext === '.yaml' || ext === '.yml') {
          // Check if it might be Kubernetes or CloudFormation
          if (file.includes('k8s') || file.includes('kubernetes') || file.includes('deploy')) {
            stats.hasKubernetes = true;
          }
          if (file.includes('cloudformation') || file.includes('cfn')) {
            stats.hasCloudFormation = true;
          }
        }
      }

      // Determine primary language
      let maxCount = 0;
      for (const [lang, count] of Object.entries(stats.languages)) {
        if (count > maxCount) {
          maxCount = count;
          stats.primary = lang;
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to detect languages: ${error}`);
    }

    return stats;
  }

  async getRepoSize(workDir: string): Promise<number> {
    try {
      const { stdout } = await execAsync('git count-objects -vH', { cwd: workDir });
      const match = stdout.match(/size-pack:\s*(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    } catch {
      // Fallback: get directory size
    }
    return 0;
  }

  async cleanup(workDir: string): Promise<void> {
    try {
      this.logger.log(`Cleaning up ${workDir}`);
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(`Failed to cleanup ${workDir}: ${error}`);
    }
  }
}
