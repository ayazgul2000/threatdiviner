// apps/api/src/libs/auth/services/email-verification.service.ts
// Email verification service with secure token generation

import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SendVerificationResult {
  success: boolean;
  email: string;
  message: string;
  // In dev mode, include token for testing
  token?: string;
}

export interface VerifyEmailResult {
  success: boolean;
  message: string;
  email?: string;
}

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly tokenExpiryHours = 48; // 48 hours

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Send email verification - generates token for newly registered users
   */
  async sendVerification(userId: string, email: string): Promise<SendVerificationResult> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if email is already verified
    if (user.emailVerified && user.email.toLowerCase() === email.toLowerCase()) {
      return {
        success: true,
        email,
        message: 'Email is already verified',
      };
    }

    // Check if email is already used by another user
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId: user.tenantId,
        id: { not: userId },
      },
    });

    if (existingUser) {
      throw new ConflictException('Email is already in use by another account');
    }

    // Invalidate any existing verification tokens for this user/email combo
    await this.prisma.emailVerification.updateMany({
      where: {
        userId,
        email: email.toLowerCase(),
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Generate secure token
    const token = this.generateSecureToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.tokenExpiryHours);

    // Store verification
    await this.prisma.emailVerification.create({
      data: {
        userId,
        email: email.toLowerCase(),
        token: tokenHash,
        expiresAt,
      },
    });

    this.logger.log(`Email verification sent for user ${userId} to ${email}`);

    // In development, return the actual token for testing
    const isDev = process.env.NODE_ENV !== 'production';

    return {
      success: true,
      email,
      message: 'Verification email sent',
      ...(isDev && { token }),
    };
  }

  /**
   * Resend verification email
   */
  async resendVerification(userId: string): Promise<SendVerificationResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      return {
        success: true,
        email: user.email,
        message: 'Email is already verified',
      };
    }

    return this.sendVerification(userId, user.email);
  }

  /**
   * Verify email using token
   */
  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    const tokenHash = this.hashToken(token);

    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        token: tokenHash,
        usedAt: null,
      },
      include: {
        user: true,
      },
    });

    if (!verification) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (new Date() > verification.expiresAt) {
      throw new BadRequestException('Verification token has expired');
    }

    // Update user and mark token as used in a transaction
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verification.userId },
        data: {
          email: verification.email, // Update email if it was a change
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.emailVerification.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      }),
    ]);

    this.logger.log(`Email verified for user ${verification.userId}: ${verification.email}`);

    return {
      success: true,
      message: 'Email verified successfully',
      email: verification.email,
    };
  }

  /**
   * Check if user's email is verified
   */
  async isEmailVerified(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    });

    return user?.emailVerified || false;
  }

  /**
   * Request email change (sends verification to new email)
   */
  async requestEmailChange(userId: string, newEmail: string): Promise<SendVerificationResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if new email is same as current
    if (user.email.toLowerCase() === newEmail.toLowerCase()) {
      throw new BadRequestException('New email is the same as current email');
    }

    // Check if new email is already in use
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: newEmail.toLowerCase(),
        tenantId: user.tenantId,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    return this.sendVerification(userId, newEmail);
  }

  /**
   * Clean up expired verification tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.emailVerification.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired email verification tokens`);
    }

    return result.count;
  }

  /**
   * Generate a cryptographically secure token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash token for storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
