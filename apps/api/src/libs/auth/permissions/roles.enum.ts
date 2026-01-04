/**
 * Organization-level roles
 * Defines what a user can do at the organization (tenant) level
 */
export enum OrgRole {
  OWNER = 'owner',     // Full access, billing, delete org
  ADMIN = 'admin',     // Manage users, settings (no billing/delete)
  MEMBER = 'member',   // Access assigned projects only
  VIEWER = 'viewer',   // Read-only access to assigned projects
}

/**
 * Project-level roles
 * Defines what a user can do within a specific project
 */
export enum ProjectRole {
  ADMIN = 'admin',         // Full project access, settings, delete
  MAINTAINER = 'maintainer', // Manage scans, findings, team
  DEVELOPER = 'developer',   // View findings, mark resolved
  VIEWER = 'viewer',         // Read-only
}

/**
 * Role hierarchy for org-level roles (higher = more access)
 */
export const ORG_ROLE_HIERARCHY: Record<OrgRole, number> = {
  [OrgRole.OWNER]: 4,
  [OrgRole.ADMIN]: 3,
  [OrgRole.MEMBER]: 2,
  [OrgRole.VIEWER]: 1,
};

/**
 * Role hierarchy for project-level roles (higher = more access)
 */
export const PROJECT_ROLE_HIERARCHY: Record<ProjectRole, number> = {
  [ProjectRole.ADMIN]: 4,
  [ProjectRole.MAINTAINER]: 3,
  [ProjectRole.DEVELOPER]: 2,
  [ProjectRole.VIEWER]: 1,
};

/**
 * Check if an org role has at least the required level
 */
export function hasOrgRoleLevel(userRole: string, requiredRole: OrgRole): boolean {
  const userLevel = ORG_ROLE_HIERARCHY[userRole as OrgRole] ?? 0;
  const requiredLevel = ORG_ROLE_HIERARCHY[requiredRole];
  return userLevel >= requiredLevel;
}

/**
 * Check if a project role has at least the required level
 */
export function hasProjectRoleLevel(userRole: string, requiredRole: ProjectRole): boolean {
  const userLevel = PROJECT_ROLE_HIERARCHY[userRole as ProjectRole] ?? 0;
  const requiredLevel = PROJECT_ROLE_HIERARCHY[requiredRole];
  return userLevel >= requiredLevel;
}

/**
 * Check if a user has any of the specified org roles
 */
export function hasAnyOrgRole(userRole: string, roles: OrgRole[]): boolean {
  return roles.some(role => userRole === role);
}

/**
 * Check if a user has any of the specified project roles
 */
export function hasAnyProjectRole(userRole: string, roles: ProjectRole[]): boolean {
  return roles.some(role => userRole === role);
}
