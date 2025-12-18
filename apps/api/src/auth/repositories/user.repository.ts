import { Injectable } from '@nestjs/common';
import { IUserRepository, IUser, ITenant } from '@altaniche/auth';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<IUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user;
  }

  async findByEmail(email: string, tenantId?: string): Promise<IUser | null> {
    if (tenantId) {
      return this.prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email } },
      });
    }
    return this.prisma.user.findFirst({ where: { email } });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    role: string;
    tenantId?: string;
  }): Promise<IUser> {
    if (!data.tenantId) {
      throw new Error('tenantId is required for multi-tenant mode');
    }
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        tenantId: data.tenantId,
      },
    });
  }

  async findByIdWithTenant(id: string): Promise<(IUser & { tenant?: ITenant }) | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { tenant: true },
    });
    return user;
  }
}
