import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ScanOutput } from '../interfaces';

// Allowlist of safe scanner commands (include .exe variants for Windows)
const ALLOWED_COMMANDS = new Set([
  'semgrep',
  'semgrep.exe',
  'gitleaks',
  'gitleaks.exe',
  'trivy',
  'trivy.exe',
  'bandit',
  'bandit.exe',
  'gosec',
  'gosec.exe',
  'checkov',
  'checkov.exe',
  'nuclei',
  'nuclei.exe',
  'zap',
  'zap.exe',
  'docker',
  'docker.exe',
  'where',
  'where.exe',
  'which',
  // Pen testing tools
  'sqlmap',
  'sqlmap.exe',
  'sslyze',
  'sslyze.exe',
  'nikto',
  'nikto.exe',
  'pip',
  'pip.exe',
  'perl',
  'perl.exe',
  // Discovery/crawling tools
  'katana',
  'katana.exe',
]);

// Dangerous shell metacharacters that could enable injection
// Note: backslash excluded to allow Windows paths
const DANGEROUS_CHARS = /[;&|`$(){}[\]<>!*?#~]/;

export interface ScanProgress {
  scanner: string;
  phase?: string;
  current?: number;
  total?: number;
  percent: number;
  templateStats?: {
    loaded: number;
    completed: number;
    matched: number;
    errors: number;
  };
}

export interface ExecuteOptions {
  command: string;
  args: string[];
  cwd: string;
  /** Timeout in ms. Set to 0 or omit to disable timeout (process runs until completion). */
  timeout?: number;
  env?: Record<string, string>;
  onProgress?: (progress: ScanProgress) => void;
  onStderr?: (line: string) => void;
  onStdout?: (line: string) => void;
  /** Optional scan ID for tracking/cancellation */
  scanId?: string;
}

@Injectable()
export class LocalExecutorService {
  private readonly logger = new Logger(LocalExecutorService.name);
  /** Track running processes by scanId for cancellation */
  private readonly runningProcesses = new Map<string, ChildProcess>();

  /**
   * Kill a running process by scanId
   * On Windows, uses taskkill /T to kill the entire process tree
   */
  killProcess(scanId: string): boolean {
    const proc = this.runningProcesses.get(scanId);
    if (proc && !proc.killed && proc.pid) {
      this.logger.log(`Killing process for scan ${scanId} (PID: ${proc.pid})`);

      if (process.platform === 'win32') {
        // On Windows, use taskkill with /T flag to kill entire process tree
        // This ensures child processes (like nuclei.exe spawned by cmd.exe) are also killed
        const { execSync } = require('child_process');
        try {
          execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
          this.logger.log(`Killed process tree for PID ${proc.pid}`);
        } catch (e) {
          this.logger.warn(`taskkill failed for PID ${proc.pid}: ${e}`);
        }
      } else {
        // On Unix, use process group kill
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 3000);
      }

      this.runningProcesses.delete(scanId);
      return true;
    }
    return false;
  }

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
    const { command, args, cwd, timeout, env = {}, onProgress: _onProgress, onStderr, onStdout, scanId } = options;

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

      // Don't use shell for direct executables (.exe) on Windows - shell buffers stdout/stderr
      // Only use shell for commands that need PATH resolution (like 'pip', 'where', etc.)
      const isDirectExecutable = command.includes('/') || command.includes('\\') || command.endsWith('.exe');
      const useShell = process.platform === 'win32' && !isDirectExecutable;

      this.logger.debug(`Spawning: shell=${useShell}, isDirectExecutable=${isDirectExecutable}`);

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
        shell: useShell,
        // stdin: ignore (no input needed), stdout/stderr: pipe for capture
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Track process for cancellation if scanId provided
      if (scanId) {
        this.runningProcesses.set(scanId, childProcess);
      }

      childProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;

        // Call onStdout callback for each line (used for progress parsing)
        if (onStdout) {
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              onStdout(line);
            }
          }
        }
      });

      childProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;

        // Call onStderr callback for each line (used for progress parsing)
        if (onStderr) {
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              onStderr(line);
            }
          }
        }
      });

      // Only set timeout if a positive value was provided
      const timeoutId = timeout && timeout > 0 ? setTimeout(() => {
        timedOut = true;
        this.logger.warn(`Process timed out after ${timeout}ms, killing...`);

        if (process.platform === 'win32' && childProcess.pid) {
          // On Windows, use taskkill to kill process tree
          const { execSync } = require('child_process');
          try {
            execSync(`taskkill /F /T /PID ${childProcess.pid}`, { stdio: 'ignore' });
            this.logger.log(`Killed process tree for PID ${childProcess.pid} on timeout`);
          } catch (e) {
            this.logger.warn(`taskkill failed on timeout: ${e}`);
            childProcess.kill();
          }
        } else {
          childProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 5000);
        }
      }, timeout) : null;

      childProcess.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        // Clean up process tracking
        if (scanId) {
          this.runningProcesses.delete(scanId);
        }

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
        if (timeoutId) clearTimeout(timeoutId);
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
      // If it's a full path, check if file exists
      if (path.isAbsolute(command) || command.includes('/') || command.includes('\\')) {
        const exists = fs.existsSync(command);
        this.logger.log(`Checking if ${command} exists: ${exists}`);
        return exists;
      }

      // Otherwise use where/which to find in PATH
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
