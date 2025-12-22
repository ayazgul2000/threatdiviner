import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface CreateApiKeyDto {
  name: string;
  scopes: string[];
  expiresAt?: Date;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  tenantId?: string;
  userId?: string;
  scopes?: string[];
}

// Available API key scopes
export const API_KEY_SCOPES = [
  'scans:read',
  'scans:trigger',
  'findings:read',
  'findings:update',
  'repositories:read',
  'repositories:manage',
  'reports:generate',
  'baselines:read',
  'baselines:manage',
] as const;

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);
  private readonly keyPrefix = 'td_';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a new API key
   */
  async createApiKey(
    tenantId: string,
    userId: string,
    data: CreateApiKeyDto,
  ): Promise<{ apiKey: any; rawKey: string }> {
    // Validate scopes
    const validScopes = data.scopes.filter(s =>
      API_KEY_SCOPES.includes(s as typeof API_KEY_SCOPES[number])
    );

    if (validScopes.length === 0) {
      throw new Error('At least one valid scope is required');
    }

    // Generate random key
    const rawKey = this.generateRawKey();
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12); // "td_" + first 9 random chars

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        userId,
        name: data.name,
        keyHash,
        keyPrefix,
        scopes: validScopes,
        expiresAt: data.expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    this.logger.log(`Created API key ${apiKey.id} for user ${userId}`);

    return {
      apiKey,
      rawKey, // Only returned once at creation
    };
  }

  /**
   * List API keys for a user
   */
  async listApiKeys(tenantId: string, userId: string): Promise<any[]> {
    return this.prisma.apiKey.findMany({
      where: { tenantId, userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(tenantId: string, userId: string, keyId: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, tenantId, userId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({
      where: { id: keyId },
    });

    this.logger.log(`Deleted API key ${keyId}`);
  }

  /**
   * Validate an API key and return associated info
   */
  async validateApiKey(rawKey: string): Promise<ApiKeyValidationResult> {
    if (!rawKey.startsWith(this.keyPrefix)) {
      return { valid: false };
    }

    const keyHash = this.hashKey(rawKey);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: { keyHash },
      include: {
        user: {
          select: { email: true, status: true },
        },
        tenant: {
          select: { isActive: true },
        },
      },
    });

    if (!apiKey) {
      return { valid: false };
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false };
    }

    // Check user status
    if (apiKey.user.status !== 'active') {
      return { valid: false };
    }

    // Check tenant status
    if (!apiKey.tenant.isActive) {
      return { valid: false };
    }

    // Update last used timestamp (fire and forget)
    this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return {
      valid: true,
      tenantId: apiKey.tenantId,
      userId: apiKey.userId,
      scopes: apiKey.scopes,
    };
  }

  /**
   * Check if a scope is authorized
   */
  hasScope(userScopes: string[], requiredScope: string): boolean {
    // Check exact match
    if (userScopes.includes(requiredScope)) {
      return true;
    }

    // Check wildcard (e.g., scans:* matches scans:read)
    const [resource] = requiredScope.split(':');
    return userScopes.includes(`${resource}:*`);
  }

  /**
   * Rotate an API key (create new, delete old)
   */
  async rotateApiKey(
    tenantId: string,
    userId: string,
    keyId: string,
  ): Promise<{ apiKey: any; rawKey: string }> {
    const existingKey = await this.prisma.apiKey.findFirst({
      where: { id: keyId, tenantId, userId },
    });

    if (!existingKey) {
      throw new NotFoundException('API key not found');
    }

    // Create new key with same settings
    const result = await this.createApiKey(tenantId, userId, {
      name: existingKey.name,
      scopes: existingKey.scopes,
      expiresAt: existingKey.expiresAt || undefined,
    });

    // Delete old key
    await this.prisma.apiKey.delete({
      where: { id: keyId },
    });

    this.logger.log(`Rotated API key ${keyId} -> ${result.apiKey.id}`);

    return result;
  }

  /**
   * Generate a random API key
   */
  private generateRawKey(): string {
    const random = crypto.randomBytes(32).toString('base64url');
    return `${this.keyPrefix}${random}`;
  }

  /**
   * Hash an API key for storage
   */
  private hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }
}
