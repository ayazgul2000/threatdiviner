// apps/api/src/libs/auth/services/session.service.ts
// Session management service with secure refresh token handling

import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CreateSessionInput {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  rememberMe?: boolean;
}

export interface SessionInfo {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  // Session duration settings
  private readonly defaultSessionDays = 7;
  private readonly rememberMeSessionDays = 30;
  private readonly maxSessionsPerUser = 10;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new session for a user
   */
  async createSession(input: CreateSessionInput): Promise<{
    sessionId: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const { userId, userAgent, ipAddress, rememberMe } = input;

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Enforce max sessions limit
    await this.enforceSessionLimit(userId);

    // Generate secure refresh token
    const refreshToken = this.generateRefreshToken();
    const hashedToken = this.hashToken(refreshToken);

    // Calculate expiry
    const sessionDays = rememberMe ? this.rememberMeSessionDays : this.defaultSessionDays;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + sessionDays);

    // Create session
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        refreshToken: hashedToken,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
        expiresAt,
      },
    });

    this.logger.log(`Session created for user ${userId}: ${session.id}`);

    return {
      sessionId: session.id,
      refreshToken,
      expiresAt,
    };
  }

  /**
   * Validate a refresh token and return the session
   */
  async validateRefreshToken(refreshToken: string): Promise<{
    sessionId: string;
    userId: string;
    valid: boolean;
  }> {
    const hashedToken = this.hashToken(refreshToken);

    const session = await this.prisma.userSession.findFirst({
      where: {
        refreshToken: hashedToken,
        revokedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!session) {
      return { sessionId: '', userId: '', valid: false };
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      // Mark as expired
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      return { sessionId: session.id, userId: session.userId, valid: false };
    }

    // Check if user is still active
    if (session.user.status !== 'active') {
      return { sessionId: session.id, userId: session.userId, valid: false };
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      valid: true,
    };
  }

  /**
   * Refresh a session - rotates the refresh token
   */
  async refreshSession(oldRefreshToken: string): Promise<{
    sessionId: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const hashedOldToken = this.hashToken(oldRefreshToken);

    const session = await this.prisma.userSession.findFirst({
      where: {
        refreshToken: hashedOldToken,
        revokedAt: null,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > session.expiresAt) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session expired');
    }

    // Generate new refresh token (token rotation)
    const newRefreshToken = this.generateRefreshToken();
    const hashedNewToken = this.hashToken(newRefreshToken);

    // Extend expiry based on original duration
    const originalDuration = session.expiresAt.getTime() - session.createdAt.getTime();
    const newExpiresAt = new Date(Date.now() + originalDuration);

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: hashedNewToken,
        lastActiveAt: new Date(),
        expiresAt: newExpiresAt,
      },
    });

    this.logger.debug(`Session ${session.id} refreshed`);

    return {
      sessionId: session.id,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt,
    };
  }

  /**
   * Update session activity timestamp
   */
  async updateActivity(sessionId: string): Promise<void> {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, userId?: string): Promise<void> {
    const whereClause: any = { id: sessionId };
    if (userId) {
      whereClause.userId = userId;
    }

    const session = await this.prisma.userSession.findFirst({
      where: whereClause,
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Session ${sessionId} revoked`);
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const whereClause: any = {
      userId,
      revokedAt: null,
    };

    if (exceptSessionId) {
      whereClause.id = { not: exceptSessionId };
    }

    const result = await this.prisma.userSession.updateMany({
      where: whereClause,
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Revoked ${result.count} sessions for user ${userId}`);

    return result.count;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string, currentSessionId?: string): Promise<SessionInfo[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions.map(session => ({
      id: session.id,
      userId: session.userId,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      isCurrent: session.id === currentSessionId,
    }));
  }

  /**
   * Get session count for a user
   */
  async getActiveSessionCount(userId: string): Promise<number> {
    return this.prisma.userSession.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Clean up expired sessions (run periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired/revoked sessions`);
    }

    return result.count;
  }

  /**
   * Parse user agent to get device/browser info
   */
  parseUserAgent(userAgent: string | null): {
    browser: string;
    os: string;
    device: string;
  } {
    if (!userAgent) {
      return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
    }

    // Simple user agent parsing
    let browser = 'Unknown';
    let os = 'Unknown';
    let device = 'Desktop';

    // Browser detection
    if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Chrome')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Safari')) {
      browser = 'Safari';
    } else if (userAgent.includes('Edge')) {
      browser = 'Edge';
    } else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
      browser = 'Internet Explorer';
    }

    // OS detection
    if (userAgent.includes('Windows')) {
      os = 'Windows';
    } else if (userAgent.includes('Mac OS')) {
      os = 'macOS';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
      device = 'Mobile';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'iOS';
      device = userAgent.includes('iPad') ? 'Tablet' : 'Mobile';
    }

    // Device detection
    if (userAgent.includes('Mobile')) {
      device = 'Mobile';
    } else if (userAgent.includes('Tablet')) {
      device = 'Tablet';
    }

    return { browser, os, device };
  }

  // ========== Private Methods ==========

  /**
   * Generate a cryptographically secure refresh token
   */
  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('base64url');
  }

  /**
   * Hash a token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Enforce maximum sessions per user
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    const activeSessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'asc' },
    });

    // If at limit, revoke the oldest session
    if (activeSessions.length >= this.maxSessionsPerUser) {
      const sessionsToRevoke = activeSessions.slice(
        0,
        activeSessions.length - this.maxSessionsPerUser + 1
      );

      for (const session of sessionsToRevoke) {
        await this.prisma.userSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }

      this.logger.log(
        `Revoked ${sessionsToRevoke.length} oldest sessions for user ${userId} (limit: ${this.maxSessionsPerUser})`
      );
    }
  }
}
