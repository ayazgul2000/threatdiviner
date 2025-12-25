import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NormalizedFinding } from '../interfaces';

interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

interface FileChanges {
  filePath: string;
  hunks: DiffHunk[];
  addedLines: Set<number>;
  modifiedLineRanges: Array<{ start: number; end: number }>;
}

export interface DiffData {
  files: Map<string, FileChanges>;
  totalAdditions: number;
  totalDeletions: number;
}

@Injectable()
export class DiffFilterService {
  private readonly logger = new Logger(DiffFilterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse unified diff format to extract changed line numbers per file
   */
  parseDiff(diffText: string): DiffData {
    const files = new Map<string, FileChanges>();
    let totalAdditions = 0;
    let totalDeletions = 0;
    let currentFile: FileChanges | null = null;
    let currentNewLine = 0;

    const lines = diffText.split('\n');

    for (const line of lines) {
      // Match file header: diff --git a/path b/path or +++ b/path
      if (line.startsWith('+++ b/') || line.startsWith('+++ "b/')) {
        const filePath = this.extractFilePath(line);
        currentFile = {
          filePath,
          hunks: [],
          addedLines: new Set(),
          modifiedLineRanges: [],
        };
        files.set(filePath, currentFile);
        continue;
      }

      // Match hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch && currentFile) {
        const hunk: DiffHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldCount: parseInt(hunkMatch[2] || '1', 10),
          newStart: parseInt(hunkMatch[3], 10),
          newCount: parseInt(hunkMatch[4] || '1', 10),
        };
        currentFile.hunks.push(hunk);
        currentNewLine = hunk.newStart;

        // Add the entire hunk range as a modified range
        currentFile.modifiedLineRanges.push({
          start: hunk.newStart,
          end: hunk.newStart + hunk.newCount - 1,
        });
        continue;
      }

      // Track additions and deletions
      if (currentFile && currentNewLine > 0) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentFile.addedLines.add(currentNewLine);
          totalAdditions++;
          currentNewLine++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          totalDeletions++;
          // Deletion doesn't increment the new line number
        } else if (!line.startsWith('\\')) {
          // Context line
          currentNewLine++;
        }
      }
    }

    this.logger.log(
      `Parsed diff: ${files.size} files, ${totalAdditions} additions, ${totalDeletions} deletions`,
    );

    return { files, totalAdditions, totalDeletions };
  }

  /**
   * Filter findings to only those affecting changed lines
   */
  filterFindingsByDiff(
    findings: NormalizedFinding[],
    diffData: DiffData,
    includeContext = 3,
  ): NormalizedFinding[] {
    const filtered: NormalizedFinding[] = [];
    let skipped = 0;

    for (const finding of findings) {
      const fileChanges = this.findFileChanges(finding.filePath, diffData);

      if (!fileChanges) {
        // File not in diff at all - skip
        skipped++;
        continue;
      }

      // Check if finding is within a changed range (with context)
      const isInChangedRange = this.isLineInChangedRange(
        finding.startLine || 0,
        finding.endLine || finding.startLine || 0,
        fileChanges,
        includeContext,
      );

      if (isInChangedRange) {
        filtered.push(finding);
      } else {
        skipped++;
      }
    }

    this.logger.log(
      `Diff filter: ${filtered.length} findings in changed lines, ${skipped} skipped`,
    );

    return filtered;
  }

  /**
   * Find file changes, handling path normalization
   */
  private findFileChanges(
    filePath: string,
    diffData: DiffData,
  ): FileChanges | undefined {
    // Normalize path
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Try exact match first
    if (diffData.files.has(normalizedPath)) {
      return diffData.files.get(normalizedPath);
    }

    // Try matching just the filename if path doesn't match
    for (const [diffPath, changes] of diffData.files) {
      if (
        normalizedPath.endsWith(diffPath) ||
        diffPath.endsWith(normalizedPath)
      ) {
        return changes;
      }
    }

    // Try matching basename
    const basename = normalizedPath.split('/').pop() || normalizedPath;
    for (const [diffPath, changes] of diffData.files) {
      const diffBasename = diffPath.split('/').pop();
      if (diffBasename === basename) {
        return changes;
      }
    }

    return undefined;
  }

  /**
   * Check if a line range falls within changed areas
   */
  private isLineInChangedRange(
    startLine: number,
    endLine: number,
    fileChanges: FileChanges,
    context: number,
  ): boolean {
    // Check if any line in the finding range is in the added lines
    for (let line = startLine; line <= endLine; line++) {
      if (fileChanges.addedLines.has(line)) {
        return true;
      }
    }

    // Check if finding overlaps with any modified range (with context)
    for (const range of fileChanges.modifiedLineRanges) {
      const expandedStart = Math.max(1, range.start - context);
      const expandedEnd = range.end + context;

      if (startLine <= expandedEnd && endLine >= expandedStart) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract file path from diff header
   */
  private extractFilePath(line: string): string {
    // Handle +++ b/path or +++ "b/path with spaces"
    if (line.startsWith('+++ "b/')) {
      return line.slice(7, -1); // Remove +++ "b/ and trailing "
    }
    return line.slice(6); // Remove +++ b/
  }

  /**
   * Cache diff data for a scan
   */
  async cacheDiff(
    scanId: string,
    pullRequestId: string,
    diffData: DiffData,
  ): Promise<void> {
    // Convert Map to serializable format
    const filesArray = Array.from(diffData.files.entries()).map(
      ([path, changes]) => ({
        path,
        hunks: changes.hunks,
        addedLines: Array.from(changes.addedLines),
        modifiedLineRanges: changes.modifiedLineRanges,
      }),
    );

    const jsonData = JSON.parse(JSON.stringify({
      files: filesArray,
      totalAdditions: diffData.totalAdditions,
      totalDeletions: diffData.totalDeletions,
    }));

    await this.prisma.diffCache.upsert({
      where: { scanId },
      create: {
        scanId,
        pullRequestId,
        diffData: jsonData,
      },
      update: {
        pullRequestId,
        diffData: jsonData,
      },
    });
  }

  /**
   * Get cached diff data for a scan
   */
  async getCachedDiff(scanId: string): Promise<DiffData | null> {
    const cached = await this.prisma.diffCache.findUnique({
      where: { scanId },
    });

    if (!cached) {
      return null;
    }

    // Reconstruct DiffData from cached JSON
    const data = cached.diffData as any;
    const files = new Map<string, FileChanges>();

    for (const file of data.files || []) {
      files.set(file.path, {
        filePath: file.path,
        hunks: file.hunks,
        addedLines: new Set(file.addedLines),
        modifiedLineRanges: file.modifiedLineRanges,
      });
    }

    return {
      files,
      totalAdditions: data.totalAdditions || 0,
      totalDeletions: data.totalDeletions || 0,
    };
  }

  /**
   * Get statistics about which files in the diff have findings
   */
  getFilesWithFindings(
    findings: NormalizedFinding[],
    diffData: DiffData,
  ): Map<string, number> {
    const fileCounts = new Map<string, number>();

    for (const finding of findings) {
      const normalizedPath = finding.filePath.replace(/\\/g, '/');
      if (diffData.files.has(normalizedPath)) {
        fileCounts.set(
          normalizedPath,
          (fileCounts.get(normalizedPath) || 0) + 1,
        );
      }
    }

    return fileCounts;
  }
}
