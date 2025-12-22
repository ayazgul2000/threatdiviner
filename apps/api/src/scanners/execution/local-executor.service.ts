import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { ScanOutput } from '../interfaces';

// Allowlist of safe scanner commands
const ALLOWED_COMMANDS = new Set([
  'semgrep',
  'gitleaks',
  'trivy',
  'bandit',
  'gosec',
  'checkov',
  'nuclei',
  'zap',
  'docker',
  'where',
  'which',
]);

// Dangerous shell metacharacters that could enable injection
const DANGEROUS_CHARS = /[;&|`$(){}[\]<>\\!*?#~]/;

export interface ExecuteOptions {
  command: string;
  args: string[];
  cwd: string;
  timeout: number;
  env?: Record<string, string>;
}

@Injectable()
export class LocalExecutorService {
  private readonly logger = new Logger(LocalExecutorService.name);

  /**
   * Sanitize command arguments to prevent injection attacks
   */
  private sanitizeArg(arg: string): string {
    // Log and reject arguments with dangerous characters
    if (DANGEROUS_CHARS.test(arg)) {
      this.logger.warn(`Potentially dangerous argument rejected: ${arg}`);
      throw new Error(`Invalid argument: contains dangerous characters`);
    }
    return arg;
  }

  /**
   * Validate command is in allowlist
   */
  private validateCommand(command: string): void {
    const baseCommand = command.split('/').pop()?.split('\\').pop() || command;
    if (!ALLOWED_COMMANDS.has(baseCommand)) {
      this.logger.warn(`Command not in allowlist: ${command}`);
      throw new Error(`Command not allowed: ${command}`);
    }
  }

  async execute(options: ExecuteOptions): Promise<ScanOutput> {
    const { command, args, cwd, timeout, env = {} } = options;

    // Security: Validate command is allowed
    this.validateCommand(command);

    // Security: Sanitize all arguments (skip for docker as it needs special handling)
    const sanitizedArgs = command === 'docker'
      ? args // Docker args are internally controlled
      : args.map(arg => this.sanitizeArg(arg));
    const startTime = Date.now();

    this.logger.log(`Executing: ${command} ${sanitizedArgs.join(' ')}`);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const childProcess = spawn(command, sanitizedArgs, {
        cwd,
        timeout,
        env: {
          ...process.env,
          // Force Python UTF-8 encoding for Windows compatibility
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
          ...env,
        },
        shell: process.platform === 'win32',
      });

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        timedOut = true;
        childProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      childProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        this.logger.log(`${command} completed in ${duration}ms with code ${code}`);

        resolve({
          scanner: command,
          exitCode: code ?? -1,
          stdout,
          stderr,
          duration,
          timedOut,
        });
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        this.logger.error(`${command} error: ${error.message}`);

        resolve({
          scanner: command,
          exitCode: -1,
          stdout,
          stderr: `${stderr}\n${error.message}`,
          duration,
          timedOut: false,
        });
      });
    });
  }

  async isCommandAvailable(command: string): Promise<boolean> {
    try {
      const result = await this.execute({
        command: process.platform === 'win32' ? 'where' : 'which',
        args: [command],
        cwd: process.cwd(),
        timeout: 5000,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async getCommandVersion(command: string, versionArg = '--version'): Promise<string> {
    try {
      const result = await this.execute({
        command,
        args: [versionArg],
        cwd: process.cwd(),
        timeout: 5000,
      });

      if (result.exitCode === 0) {
        // Extract version from output (first line usually)
        const firstLine = result.stdout.split('\n')[0];
        const versionMatch = firstLine.match(/\d+\.\d+(\.\d+)?/);
        return versionMatch ? versionMatch[0] : 'unknown';
      }
    } catch {
      // Ignore errors
    }
    return 'unknown';
  }
}
