import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        invitedAt: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return users;
  }

  async getUser(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        invitedAt: true,
        invitedBy: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async inviteUser(tenantId: string, invitedById: string, data: { email: string; role: string; name?: string }) {
    // Check if user already exists in this tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: data.email },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists in this tenant');
    }

    // Check tenant user limit
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const userCount = await this.prisma.user.count({
      where: { tenantId },
    });

    if (userCount >= tenant.maxUsers) {
      throw new ForbiddenException(`Maximum user limit (${tenant.maxUsers}) reached for this tenant`);
    }

    // Generate invite token
    const inviteToken = randomBytes(32).toString('hex');

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        name: data.name,
        role: data.role,
        status: 'invited',
        inviteToken,
        invitedBy: invitedById,
        invitedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        invitedAt: true,
        createdAt: true,
      },
    });

    // TODO: Send invitation email with inviteToken

    return user;
  }

  async acceptInvite(inviteToken: string, password: string, name?: string) {
    const user = await this.prisma.user.findFirst({
      where: { inviteToken, status: 'invited' },
    });

    if (!user) {
      throw new NotFoundException('Invalid or expired invitation');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        name: name || user.name,
        status: 'active',
        inviteToken: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return updatedUser;
  }

  async updateUserRole(tenantId: string, userId: string, currentUserId: string, role: string) {
    // Prevent self-demotion from admin
    if (userId === currentUserId && role !== 'admin') {
      const currentUser = await this.prisma.user.findFirst({
        where: { id: currentUserId, tenantId },
      });
      if (currentUser?.role === 'admin') {
        // Check if there are other admins
        const adminCount = await this.prisma.user.count({
          where: { tenantId, role: 'admin', status: 'active' },
        });
        if (adminCount <= 1) {
          throw new ForbiddenException('Cannot demote the only admin. Promote another user first.');
        }
      }
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async removeUser(tenantId: string, userId: string, currentUserId: string) {
    if (userId === currentUserId) {
      throw new ForbiddenException('Cannot remove yourself');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent removing the last admin
    if (user.role === 'admin') {
      const adminCount = await this.prisma.user.count({
        where: { tenantId, role: 'admin', status: 'active' },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot remove the only admin');
      }
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { success: true };
  }

  async resendInvite(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, status: 'invited' },
    });

    if (!user) {
      throw new NotFoundException('Invited user not found');
    }

    // Generate new invite token
    const inviteToken = randomBytes(32).toString('hex');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        inviteToken,
        invitedAt: new Date(),
      },
    });

    // TODO: Resend invitation email

    return { success: true };
  }

  async disableUser(tenantId: string, userId: string, currentUserId: string) {
    if (userId === currentUserId) {
      throw new ForbiddenException('Cannot disable yourself');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'disabled' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async enableUser(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, status: 'disabled' },
    });

    if (!user) {
      throw new NotFoundException('Disabled user not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'active' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }
}
