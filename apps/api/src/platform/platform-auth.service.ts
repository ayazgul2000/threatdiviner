import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.jwtService.sign({
      sub: admin.id,
      email: admin.email,
      type: 'platform_admin',
    });

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        isSuperAdmin: admin.isSuperAdmin,
        createdAt: admin.createdAt.toISOString(),
      },
    };
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.type !== 'platform_admin') {
        return null;
      }

      const admin = await this.prisma.platformAdmin.findUnique({
        where: { id: payload.sub },
      });

      if (!admin) {
        return null;
      }

      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        isSuperAdmin: admin.isSuperAdmin,
        createdAt: admin.createdAt.toISOString(),
      };
    } catch {
      return null;
    }
  }

  async createAdmin(email: string, password: string, name: string, isSuperAdmin = false) {
    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await this.prisma.platformAdmin.create({
      data: {
        email,
        passwordHash,
        name,
        isSuperAdmin,
      },
    });

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      isSuperAdmin: admin.isSuperAdmin,
      createdAt: admin.createdAt.toISOString(),
    };
  }
}
