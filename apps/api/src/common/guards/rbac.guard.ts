import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ORG_ROLES_KEY,
  PROJECT_ROLES_KEY,
  MIN_ORG_ROLE_KEY,
  MIN_PROJECT_ROLE_KEY,
} from '../../libs/auth/decorators/rbac.decorator';
import {
  OrgRole,
  ProjectRole,
  hasOrgRoleLevel,
  hasProjectRoleLevel,
  hasAnyOrgRole,
  hasAnyProjectRole,
} from '../../libs/auth/permissions/roles.enum';

/**
 * RBAC Guard - Role-Based Access Control with org and project scoping
 *
 * This guard checks:
 * 1. OrgMember role - User must be a member of the organization
 * 2. ProjectMember role - If projectId is present, user must be a member of the project
 *
 * Use with decorators:
 * - @RequireOrgRole(OrgRole.ADMIN) - Require specific org roles
 * - @RequireProjectRole(ProjectRole.MAINTAINER) - Require specific project roles
 * - @RequireMinOrgRole(OrgRole.MEMBER) - Require minimum org role level
 * - @RequireMinProjectRole(ProjectRole.DEVELOPER) - Require minimum project role level
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    @Optional() @Inject(Reflector) private reflector?: Reflector,
    @Optional() private prisma?: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.reflector || !this.prisma) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('No tenant context');
    }

    // Get required roles from decorators
    const requiredOrgRoles = this.reflector.getAllAndOverride<OrgRole[]>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredProjectRoles = this.reflector.getAllAndOverride<ProjectRole[]>(PROJECT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const minOrgRole = this.reflector.getAllAndOverride<OrgRole>(MIN_ORG_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const minProjectRole = this.reflector.getAllAndOverride<ProjectRole>(MIN_PROJECT_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no RBAC decorators, allow access
    if (!requiredOrgRoles && !requiredProjectRoles && !minOrgRole && !minProjectRole) {
      return true;
    }

    // Get user's org membership
    const orgMembership = await this.prisma.orgMember.findUnique({
      where: {
        userId_tenantId: {
          userId: user.sub || user.userId,
          tenantId,
        },
      },
    });

    if (!orgMembership) {
      throw new ForbiddenException('User is not a member of this organization');
    }

    // Attach org membership to request for later use
    request.orgMembership = orgMembership;

    // Check org-level roles
    if (requiredOrgRoles && requiredOrgRoles.length > 0) {
      if (!hasAnyOrgRole(orgMembership.role, requiredOrgRoles)) {
        throw new ForbiddenException(
          `Requires one of these organization roles: ${requiredOrgRoles.join(', ')}`,
        );
      }
    }

    if (minOrgRole) {
      if (!hasOrgRoleLevel(orgMembership.role, minOrgRole)) {
        throw new ForbiddenException(
          `Requires at least ${minOrgRole} organization role`,
        );
      }
    }

    // Check project-level access if projectId is present and project roles are required
    const projectId = request.params?.projectId || request.query?.projectId;

    if (projectId && (requiredProjectRoles || minProjectRole)) {
      const projectMembership = await this.prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: user.sub || user.userId,
            projectId,
          },
        },
      });

      if (!projectMembership) {
        throw new ForbiddenException('User is not a member of this project');
      }

      // Attach project membership to request for later use
      request.projectMembership = projectMembership;

      if (requiredProjectRoles && requiredProjectRoles.length > 0) {
        if (!hasAnyProjectRole(projectMembership.role, requiredProjectRoles)) {
          throw new ForbiddenException(
            `Requires one of these project roles: ${requiredProjectRoles.join(', ')}`,
          );
        }
      }

      if (minProjectRole) {
        if (!hasProjectRoleLevel(projectMembership.role, minProjectRole)) {
          throw new ForbiddenException(
            `Requires at least ${minProjectRole} project role`,
          );
        }
      }
    } else if ((requiredProjectRoles || minProjectRole) && !projectId) {
      // Project roles required but no projectId provided
      throw new ForbiddenException('Project ID is required for this operation');
    }

    return true;
  }
}
