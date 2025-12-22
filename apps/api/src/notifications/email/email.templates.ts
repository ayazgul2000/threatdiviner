export interface ScanCompleteEmailData {
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
  scanUrl: string;
}

export interface CriticalFindingEmailData {
  repositoryName: string;
  title: string;
  severity: string;
  filePath: string;
  line: number;
  ruleId: string;
  description?: string;
  findingUrl: string;
}

export interface InvitationEmailData {
  tenantName: string;
  inviterName: string;
  inviteeEmail: string;
  inviteUrl: string;
  role: string;
}

export interface WeeklySummaryEmailData {
  tenantName: string;
  periodStart: string;
  periodEnd: string;
  totalScans: number;
  totalFindings: number;
  findingsByCategory: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  topRepositories: Array<{
    name: string;
    findings: number;
  }>;
  dashboardUrl: string;
}

export const EmailTemplates = {
  scanComplete: (data: ScanCompleteEmailData): { subject: string; html: string; text: string } => {
    const statusEmoji = data.status === 'success' ? '✅' : data.status === 'failure' ? '❌' : '⚠️';
    const statusText = data.status === 'success' ? 'Passed' : data.status === 'failure' ? 'Failed' : 'Warning';

    return {
      subject: `${statusEmoji} Security Scan ${statusText}: ${data.repositoryName}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: ${data.status === 'success' ? '#10b981' : data.status === 'failure' ? '#ef4444' : '#f59e0b'}; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
    .label { color: #666; }
    .value { font-weight: 600; }
    .findings { margin-top: 24px; }
    .findings h3 { margin-bottom: 16px; }
    .finding-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .finding-box { text-align: center; padding: 16px; border-radius: 8px; }
    .critical { background: #fef2f2; color: #dc2626; }
    .high { background: #fff7ed; color: #ea580c; }
    .medium { background: #fefce8; color: #ca8a04; }
    .low { background: #f0fdf4; color: #16a34a; }
    .count { font-size: 32px; font-weight: bold; }
    .cta { margin-top: 24px; text-align: center; }
    .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .footer { padding: 16px 24px; background: #f9fafb; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Security Scan ${statusText}</h1>
    </div>
    <div class="content">
      <div class="info-row">
        <span class="label">Repository</span>
        <span class="value">${data.repositoryName}</span>
      </div>
      <div class="info-row">
        <span class="label">Branch</span>
        <span class="value">${data.branch}</span>
      </div>
      <div class="info-row">
        <span class="label">Commit</span>
        <span class="value">${data.commitSha.substring(0, 7)}</span>
      </div>
      <div class="info-row">
        <span class="label">Duration</span>
        <span class="value">${data.duration}s</span>
      </div>

      <div class="findings">
        <h3>Findings Summary (${data.findings.total} total)</h3>
        <div class="finding-grid">
          <div class="finding-box critical">
            <div class="count">${data.findings.critical}</div>
            <div>Critical</div>
          </div>
          <div class="finding-box high">
            <div class="count">${data.findings.high}</div>
            <div>High</div>
          </div>
          <div class="finding-box medium">
            <div class="count">${data.findings.medium}</div>
            <div>Medium</div>
          </div>
          <div class="finding-box low">
            <div class="count">${data.findings.low}</div>
            <div>Low</div>
          </div>
        </div>
      </div>

      <div class="cta">
        <a href="${data.scanUrl}" class="button">View Full Report</a>
      </div>
    </div>
    <div class="footer">
      <p>ThreatDiviner Security Platform</p>
    </div>
  </div>
</body>
</html>
      `,
      text: `
Security Scan ${statusText}: ${data.repositoryName}

Repository: ${data.repositoryName}
Branch: ${data.branch}
Commit: ${data.commitSha.substring(0, 7)}
Duration: ${data.duration}s

Findings Summary:
- Critical: ${data.findings.critical}
- High: ${data.findings.high}
- Medium: ${data.findings.medium}
- Low: ${data.findings.low}
- Total: ${data.findings.total}

View full report: ${data.scanUrl}
      `,
    };
  },

  criticalFinding: (data: CriticalFindingEmailData): { subject: string; html: string; text: string } => ({
    subject: `🚨 Critical Finding: ${data.title}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #dc2626; color: white; padding: 24px; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { padding: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
    .label { color: #666; }
    .value { font-weight: 600; font-family: monospace; }
    .description { margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 8px; }
    .cta { margin-top: 24px; text-align: center; }
    .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 ${data.severity.toUpperCase()} SEVERITY FINDING</h1>
    </div>
    <div class="content">
      <h2>${data.title}</h2>
      <div class="info-row">
        <span class="label">Repository</span>
        <span class="value">${data.repositoryName}</span>
      </div>
      <div class="info-row">
        <span class="label">File</span>
        <span class="value">${data.filePath}:${data.line}</span>
      </div>
      <div class="info-row">
        <span class="label">Rule ID</span>
        <span class="value">${data.ruleId}</span>
      </div>
      ${data.description ? `<div class="description">${data.description}</div>` : ''}
      <div class="cta">
        <a href="${data.findingUrl}" class="button">View Finding Details</a>
      </div>
    </div>
  </div>
</body>
</html>
    `,
    text: `
CRITICAL FINDING: ${data.title}

Severity: ${data.severity.toUpperCase()}
Repository: ${data.repositoryName}
File: ${data.filePath}:${data.line}
Rule ID: ${data.ruleId}

${data.description || ''}

View details: ${data.findingUrl}
    `,
  }),

  invitation: (data: InvitationEmailData): { subject: string; html: string; text: string } => ({
    subject: `You've been invited to join ${data.tenantName} on ThreatDiviner`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #3b82f6; color: white; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 32px; text-align: center; }
    .message { font-size: 16px; color: #374151; line-height: 1.6; }
    .cta { margin-top: 32px; }
    .button { display: inline-block; padding: 16px 32px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .note { margin-top: 24px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You're Invited!</h1>
    </div>
    <div class="content">
      <p class="message">
        <strong>${data.inviterName}</strong> has invited you to join <strong>${data.tenantName}</strong> on ThreatDiviner as a <strong>${data.role}</strong>.
      </p>
      <div class="cta">
        <a href="${data.inviteUrl}" class="button">Accept Invitation</a>
      </div>
      <p class="note">
        This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
You've been invited to join ${data.tenantName} on ThreatDiviner!

${data.inviterName} has invited you to join as a ${data.role}.

Accept your invitation: ${data.inviteUrl}

This invitation will expire in 7 days.
    `,
  }),

  weeklySummary: (data: WeeklySummaryEmailData): { subject: string; html: string; text: string } => ({
    subject: `Weekly Security Summary: ${data.tenantName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1f2937; color: white; padding: 24px; text-align: center; }
    .content { padding: 24px; }
    .period { text-align: center; color: #666; margin-bottom: 24px; }
    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-box { background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 36px; font-weight: bold; color: #1f2937; }
    .stat-label { color: #666; margin-top: 4px; }
    .findings-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 24px; }
    .finding-box { text-align: center; padding: 12px; border-radius: 6px; }
    .critical { background: #fef2f2; color: #dc2626; }
    .high { background: #fff7ed; color: #ea580c; }
    .medium { background: #fefce8; color: #ca8a04; }
    .low { background: #f0fdf4; color: #16a34a; }
    .top-repos { margin-top: 24px; }
    .top-repos h3 { margin-bottom: 16px; }
    .repo-item { display: flex; justify-content: space-between; padding: 12px; background: #f9fafb; margin-bottom: 8px; border-radius: 6px; }
    .cta { margin-top: 24px; text-align: center; }
    .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weekly Security Summary</h1>
    </div>
    <div class="content">
      <p class="period">${data.periodStart} - ${data.periodEnd}</p>

      <div class="stats">
        <div class="stat-box">
          <div class="stat-value">${data.totalScans}</div>
          <div class="stat-label">Total Scans</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${data.totalFindings}</div>
          <div class="stat-label">New Findings</div>
        </div>
      </div>

      <h3>Findings by Severity</h3>
      <div class="findings-grid">
        <div class="finding-box critical">${data.findingsByCategory.critical} Critical</div>
        <div class="finding-box high">${data.findingsByCategory.high} High</div>
        <div class="finding-box medium">${data.findingsByCategory.medium} Medium</div>
        <div class="finding-box low">${data.findingsByCategory.low} Low</div>
      </div>

      ${data.topRepositories.length > 0 ? `
      <div class="top-repos">
        <h3>Top Repositories by Findings</h3>
        ${data.topRepositories.map(r => `
          <div class="repo-item">
            <span>${r.name}</span>
            <span><strong>${r.findings}</strong> findings</span>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <div class="cta">
        <a href="${data.dashboardUrl}" class="button">View Dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>
    `,
    text: `
Weekly Security Summary: ${data.tenantName}
${data.periodStart} - ${data.periodEnd}

Summary:
- Total Scans: ${data.totalScans}
- New Findings: ${data.totalFindings}

Findings by Severity:
- Critical: ${data.findingsByCategory.critical}
- High: ${data.findingsByCategory.high}
- Medium: ${data.findingsByCategory.medium}
- Low: ${data.findingsByCategory.low}

View dashboard: ${data.dashboardUrl}
    `,
  }),
};
