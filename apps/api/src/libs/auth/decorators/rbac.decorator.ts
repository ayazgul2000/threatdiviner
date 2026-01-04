import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OrgRole, ProjectRole } from '../permissions/roles.enum';

// Metadata keys
export const ORG_ROLES_KEY = 'orgRoles';
export const PROJECT_ROLES_KEY = 'projectRoles';
export const MIN_ORG_ROLE_KEY = 'minOrgRole';
export const MIN_PROJECT_ROLE_KEY = 'minProjectRole';

/**
 * Require specific organization roles (any of the listed roles)
 * @example @RequireOrgRole(OrgRole.ADMIN, OrgRole.OWNER)
 */
export const RequireOrgRole = (...roles: OrgRole[]) => SetMetadata(ORG_ROLES_KEY, roles);

/**
 * Require specific project roles (any of the listed roles)
 * @example @RequireProjectRole(ProjectRole.ADMIN, ProjectRole.MAINTAINER)
 */
export const RequireProjectRole = (...roles: ProjectRole[]) => SetMetadata(PROJECT_ROLES_KEY, roles);

/**
 * Require minimum organization role level
 * @example @RequireMinOrgRole(OrgRole.MEMBER) // MEMBER, ADMIN, OWNER all pass
 */
export const RequireMinOrgRole = (role: OrgRole) => SetMetadata(MIN_ORG_ROLE_KEY, role);

/**
 * Require minimum project role level
 * @example @RequireMinProjectRole(ProjectRole.DEVELOPER) // DEVELOPER, MAINTAINER, ADMIN all pass
 */
export const RequireMinProjectRole = (role: ProjectRole) => SetMetadata(MIN_PROJECT_ROLE_KEY, role);

/**
 * Extract projectId from request params or query
 * @example @ProjectId() projectId: string
 */
export const ProjectId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.params?.projectId || request.query?.projectId;
  },
);

/**
 * Extract the user's org membership from the request
 * Set by RbacGuard after verification
 */
export const OrgMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.orgMembership;
  },
);

/**
 * Extract the user's project membership from the request
 * Set by RbacGuard after verification
 */
export const ProjectMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.projectMembership;
  },
);
