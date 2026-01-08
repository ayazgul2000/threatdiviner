export const QUEUE_NAMES = {
  SCAN: 'scan-jobs',
  TARGET_SCAN: 'target-scan-jobs',
  CLONE: 'clone-jobs',
  SAST: 'sast-jobs',
  SCA: 'sca-jobs',
  SECRETS: 'secrets-jobs',
  NOTIFY: 'notify-jobs',
  CLEANUP: 'cleanup-jobs',
} as const;

export const JOB_NAMES = {
  PROCESS_SCAN: 'process-scan',
  PROCESS_TARGET_SCAN: 'process-target-scan',
  CLONE_REPO: 'clone-repo',
  RUN_SAST: 'run-sast',
  RUN_SCA: 'run-sca',
  RUN_SECRETS: 'run-secrets',
  NOTIFY_GITHUB: 'notify-github',
  CLEANUP_WORKDIR: 'cleanup-workdir',
} as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // 5s, 10s, 20s
  },
  removeOnComplete: {
    age: 86400, // 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 604800, // 7 days (keep for debugging)
  },
};

export const SCAN_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  timeout: 900000, // 15 minutes max
  priority: 1,
};

export const CLONE_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  timeout: 300000, // 5 minutes
  priority: 2,
};

export const SCANNER_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  timeout: 300000, // 5 minutes per scanner
  priority: 3,
};

export const NOTIFY_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  timeout: 60000, // 1 minute
  priority: 5,
};

export const TARGET_SCAN_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  timeout: 1800000, // 30 minutes max (DAST scans take longer)
  priority: 2,
};
