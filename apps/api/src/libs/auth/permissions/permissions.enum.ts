export enum Permission {
  // Findings
  FINDINGS_READ = 'findings:read',
  FINDINGS_WRITE = 'findings:write',
  FINDINGS_DELETE = 'findings:delete',

  // Scans
  SCANS_READ = 'scans:read',
  SCANS_TRIGGER = 'scans:trigger',
  SCANS_DELETE = 'scans:delete',

  // Repositories
  REPOS_READ = 'repos:read',
  REPOS_WRITE = 'repos:write',
  REPOS_DELETE = 'repos:delete',

  // Connections
  CONNECTIONS_READ = 'connections:read',
  CONNECTIONS_WRITE = 'connections:write',
  CONNECTIONS_DELETE = 'connections:delete',

  // Settings
  SETTINGS_READ = 'settings:read',
  SETTINGS_WRITE = 'settings:write',

  // Users
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_DELETE = 'users:delete',
  USERS_MANAGE = 'users:manage', // Invite, change roles, remove

  // Reports
  REPORTS_READ = 'reports:read',
  REPORTS_GENERATE = 'reports:generate',

  // AI
  AI_TRIAGE = 'ai:triage',
}

export enum Role {
  VIEWER = 'viewer',
  DEVELOPER = 'developer',
  MEMBER = 'member',
  SECURITY_LEAD = 'security_lead',
  ADMIN = 'admin',
}

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.VIEWER]: [
    Permission.FINDINGS_READ,
    Permission.SCANS_READ,
    Permission.REPOS_READ,
    Permission.REPORTS_READ,
  ],

  [Role.DEVELOPER]: [
    Permission.FINDINGS_READ,
    Permission.SCANS_READ,
    Permission.SCANS_TRIGGER,
    Permission.REPOS_READ,
    Permission.REPORTS_READ,
  ],

  [Role.MEMBER]: [
    Permission.FINDINGS_READ,
    Permission.FINDINGS_WRITE,
    Permission.SCANS_READ,
    Permission.SCANS_TRIGGER,
    Permission.REPOS_READ,
    Permission.REPOS_WRITE,
    Permission.CONNECTIONS_READ,
    Permission.REPORTS_READ,
    Permission.REPORTS_GENERATE,
    Permission.AI_TRIAGE,
  ],

  [Role.SECURITY_LEAD]: [
    Permission.FINDINGS_READ,
    Permission.FINDINGS_WRITE,
    Permission.FINDINGS_DELETE,
    Permission.SCANS_READ,
    Permission.SCANS_TRIGGER,
    Permission.SCANS_DELETE,
    Permission.REPOS_READ,
    Permission.REPOS_WRITE,
    Permission.REPOS_DELETE,
    Permission.CONNECTIONS_READ,
    Permission.CONNECTIONS_WRITE,
    Permission.SETTINGS_READ,
    Permission.REPORTS_READ,
    Permission.REPORTS_GENERATE,
    Permission.AI_TRIAGE,
    Permission.USERS_READ,
  ],

  [Role.ADMIN]: [
    // Admin has all permissions
    Permission.FINDINGS_READ,
    Permission.FINDINGS_WRITE,
    Permission.FINDINGS_DELETE,
    Permission.SCANS_READ,
    Permission.SCANS_TRIGGER,
    Permission.SCANS_DELETE,
    Permission.REPOS_READ,
    Permission.REPOS_WRITE,
    Permission.REPOS_DELETE,
    Permission.CONNECTIONS_READ,
    Permission.CONNECTIONS_WRITE,
    Permission.CONNECTIONS_DELETE,
    Permission.SETTINGS_READ,
    Permission.SETTINGS_WRITE,
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.USERS_DELETE,
    Permission.USERS_MANAGE,
    Permission.REPORTS_READ,
    Permission.REPORTS_GENERATE,
    Permission.AI_TRIAGE,
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const roleEnum = role as Role;
  const permissions = ROLE_PERMISSIONS[roleEnum];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function getRolePermissions(role: string): Permission[] {
  const roleEnum = role as Role;
  return ROLE_PERMISSIONS[roleEnum] || [];
}
