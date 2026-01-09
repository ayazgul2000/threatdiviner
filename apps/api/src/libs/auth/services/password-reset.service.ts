// apps/api/src/libs/auth/services/password-reset.service.ts
// Password reset service with secure token generation and email integration

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { AUTH_CONFIG } from '../auth.constants';
import { AltanicheAuthConfig } from '../interfaces';
import { PrismaService } from '../../../prisma/prisma.service';

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface RequestResetResult {
  success: boolean;
  email: string;
  message: string;
  // In dev mode, include token for testing
  token?: string;
}

export interface ResetPasswordResult {
  success: boolean;
  message: string;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly tokenExpiryHours = 24; // 24 hours default
  private readonly bcryptRounds = 10;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_CONFIG) private config: AltanicheAuthConfig,
  ) {}

  /**
   * Request a password reset - generates token and returns it for email sending
   */
  async requestReset(email: string, tenantId?: string): Promise<RequestResetResult> {
    // Find user by email
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        ...(tenantId && { tenantId }),
      },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      this.logger.debug(`Password reset requested for non-existent email: ${email}`);
      return {
        success: true,
        email,
        message: 'If an account exists with this email, a password reset link will be sent.',
      };
    }

    // Invalidate any existing tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
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

    // Store token
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt,
      },
    });

    this.logger.log(`Password reset token generated for user: ${user.id}`);

    // In development, return the actual token for testing
    const isDev = process.env.NODE_ENV !== 'production';

    return {
      success: true,
      email,
      message: 'If an account exists with this email, a password reset link will be sent.',
      ...(isDev && { token }),
    };
  }

  /**
   * Validate a password reset token
   */
  async validateToken(token: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
    const tokenHash = this.hashToken(token);

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token: tokenHash,
        usedAt: null,
      },
      include: {
        user: true,
      },
    });

    if (!resetToken) {
      return { valid: false, error: 'Invalid or expired reset token' };
    }

    if (new Date() > resetToken.expiresAt) {
      return { valid: false, error: 'Reset token has expired' };
    }

    return { valid: true, userId: resetToken.userId };
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string): Promise<ResetPasswordResult> {
    // Validate password requirements
    const passwordErrors = this.validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      throw new BadRequestException(passwordErrors.join(', '));
    }

    // Validate token
    const validation = await this.validateToken(token);
    if (!validation.valid || !validation.userId) {
      throw new BadRequestException(validation.error || 'Invalid reset token');
    }

    const tokenHash = this.hashToken(token);

    // Get the reset token record
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token: tokenHash,
        usedAt: null,
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(
      newPassword,
      this.config.bcryptRounds || this.bcryptRounds
    );

    // Update password and mark token as used in a transaction
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: validation.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    this.logger.log(`Password reset completed for user: ${validation.userId}`);

    return {
      success: true,
      message: 'Password has been reset successfully',
    };
  }

  /**
   * Clean up expired tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired password reset tokens`);
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
   * Hash token for storage (don't store plaintext)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validate password requirements
   */
  private validatePassword(password: string): string[] {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return errors;
  }
}
