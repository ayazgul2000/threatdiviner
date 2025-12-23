// Slack Block Kit templates for notifications

export interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: Array<{
    color?: string;
    blocks?: SlackBlock[];
  }>;
}

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
      emoji?: boolean;
    };
    url?: string;
    action_id?: string;
  }>;
  fields?: Array<{
    type: string;
    text: string;
  }>;
  accessory?: {
    type: string;
    text?: {
      type: string;
      text: string;
      emoji?: boolean;
    };
    url?: string;
    action_id?: string;
  };
}

export interface ScanStartedData {
  repositoryName: string;
  branch: string;
  commitSha: string;
  triggeredBy: string;
  dashboardUrl: string;
}

export interface ScanCompletedData {
  repositoryName: string;
  branch: string;
  commitSha: string;
  status: 'success' | 'failure' | 'neutral';
  duration: number;
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  dashboardUrl: string;
  scanId: string;
}

export interface CriticalFindingData {
  repositoryName: string;
  title: string;
  severity: string;
  filePath: string;
  line: number;
  ruleId: string;
  dashboardUrl: string;
  findingId: string;
}

export function buildScanStartedMessage(data: ScanStartedData): SlackMessage {
  return {
    text: `Scan started for ${data.repositoryName}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Scan Started',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repository:*\n${data.repositoryName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Branch:*\n${data.branch}`,
          },
          {
            type: 'mrkdwn',
            text: `*Commit:*\n\`${data.commitSha.substring(0, 7)}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Triggered By:*\n${data.triggeredBy}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View in Dashboard',
              emoji: true,
            },
            url: data.dashboardUrl,
            action_id: 'view_dashboard',
          },
        ],
      },
    ],
  };
}

export function buildScanCompletedMessage(data: ScanCompletedData): SlackMessage {
  const statusEmoji = data.status === 'success' ? ':white_check_mark:' :
                      data.status === 'failure' ? ':x:' : ':warning:';
  const statusText = data.status === 'success' ? 'Passed' :
                     data.status === 'failure' ? 'Failed' : 'Needs Review';

  const findingsSummary = data.findings.total === 0
    ? 'No security issues found!'
    : `*${data.findings.critical}* critical, *${data.findings.high}* high, *${data.findings.medium}* medium, *${data.findings.low}* low`;

  const durationStr = data.duration < 60
    ? `${data.duration}s`
    : `${Math.floor(data.duration / 60)}m ${data.duration % 60}s`;

  return {
    text: `Scan ${statusText.toLowerCase()} for ${data.repositoryName}: ${data.findings.total} findings`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} Scan ${statusText}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repository:*\n${data.repositoryName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Branch:*\n${data.branch}`,
          },
          {
            type: 'mrkdwn',
            text: `*Commit:*\n\`${data.commitSha.substring(0, 7)}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Duration:*\n${durationStr}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Findings:* ${findingsSummary}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Scan Details',
              emoji: true,
            },
            url: `${data.dashboardUrl}/dashboard/scans?id=${data.scanId}`,
            action_id: 'view_scan',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Findings',
              emoji: true,
            },
            url: `${data.dashboardUrl}/dashboard/findings?scanId=${data.scanId}`,
            action_id: 'view_findings',
          },
        ],
      },
    ],
  };
}

export function buildCriticalFindingMessage(data: CriticalFindingData): SlackMessage {
  const severityEmoji = data.severity === 'critical' ? ':rotating_light:' : ':warning:';

  return {
    text: `${data.severity.toUpperCase()} finding in ${data.repositoryName}: ${data.title}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji} ${data.severity.toUpperCase()} Security Finding`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${data.title}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repository:*\n${data.repositoryName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Rule:*\n${data.ruleId}`,
          },
          {
            type: 'mrkdwn',
            text: `*File:*\n\`${data.filePath}:${data.line}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${data.severity.toUpperCase()}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Finding',
              emoji: true,
            },
            url: `${data.dashboardUrl}/dashboard/findings?id=${data.findingId}`,
            action_id: 'view_finding',
          },
        ],
      },
    ],
  };
}

export function buildTestMessage(tenantName: string): SlackMessage {
  return {
    text: `ThreatDiviner notifications configured successfully for ${tenantName}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':white_check_mark: ThreatDiviner Connected',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Slack notifications are now configured for *${tenantName}*. You will receive alerts for:\n\n- Scan completions\n- Critical security findings\n- High severity findings (if enabled)`,
        },
      },
    ],
  };
}
