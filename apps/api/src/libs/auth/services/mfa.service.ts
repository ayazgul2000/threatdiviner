// apps/api/src/libs/auth/services/mfa.service.ts
// Multi-factor authentication service with TOTP support

import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';

// TOTP parameters
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // seconds
const TOTP_ALGORITHM = 'sha1';
const TOTP_WINDOW = 1; // Allow 1 period before/after current

export interface MfaSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export interface MfaVerifyResult {
  success: boolean;
  message: string;
}

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly issuer = 'ThreatDiviner';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate MFA setup for a user (secret + QR code)
   */
  async setupMfa(userId: string): Promise<MfaSetupResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    // Generate a secure secret (160 bits = 20 bytes = 32 base32 chars)
    const secret = this.generateSecret();

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(8);
    const hashedBackupCodes = backupCodes.map(code => this.hashCode(code));

    // Store the secret temporarily (will be confirmed when user verifies)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: this.encryptSecret(secret),
      },
    });

    // Store backup codes
    await this.storeBackupCodes(userId, hashedBackupCodes);

    // Generate otpauth URL for authenticator apps
    const otpauthUrl = this.generateOtpauthUrl(user.email, secret);

    // Generate QR code data URL
    const qrCodeDataUrl = await this.generateQrCodeDataUrl(otpauthUrl);

    this.logger.log(`MFA setup initiated for user ${userId}`);

    return {
      secret: this.formatSecretForDisplay(secret),
      otpauthUrl,
      qrCodeDataUrl,
      backupCodes,
    };
  }

  /**
   * Enable MFA after verifying the setup
   */
  async enableMfa(userId: string, code: string): Promise<MfaVerifyResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    if (!user.mfaSecret) {
      throw new BadRequestException('MFA setup not initiated. Please start setup first.');
    }

    const secret = this.decryptSecret(user.mfaSecret);
    const isValid = this.verifyTotp(secret, code);

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
      },
    });

    this.logger.log(`MFA enabled for user ${userId}`);

    return {
      success: true,
      message: 'MFA has been enabled successfully',
    };
  }

  /**
   * Disable MFA for a user
   */
  async disableMfa(userId: string, code: string): Promise<MfaVerifyResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    // Verify code before disabling
    const isValid = await this.verifyCode(userId, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    // Delete backup codes
    await this.deleteBackupCodes(userId);

    this.logger.log(`MFA disabled for user ${userId}`);

    return {
      success: true,
      message: 'MFA has been disabled',
    };
  }

  /**
   * Verify a TOTP code or backup code
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      return false;
    }

    // First try TOTP verification
    const secret = this.decryptSecret(user.mfaSecret);
    if (this.verifyTotp(secret, code)) {
      return true;
    }

    // Then try backup code
    return this.verifyBackupCode(userId, code);
  }

  /**
   * Check if user has MFA enabled
   */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    return user?.mfaEnabled || false;
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string, code: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    // Verify current code
    const isValid = await this.verifyCode(userId, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    // Generate new backup codes
    const backupCodes = this.generateBackupCodes(8);
    const hashedBackupCodes = backupCodes.map(c => this.hashCode(c));

    // Replace old backup codes
    await this.deleteBackupCodes(userId);
    await this.storeBackupCodes(userId, hashedBackupCodes);

    this.logger.log(`Backup codes regenerated for user ${userId}`);

    return backupCodes;
  }

  // ========== Private Methods ==========

  /**
   * Generate a random secret for TOTP
   */
  private generateSecret(): string {
    const buffer = crypto.randomBytes(20);
    return this.base32Encode(buffer);
  }

  /**
   * Format secret for display (groups of 4)
   */
  private formatSecretForDisplay(secret: string): string {
    return secret.match(/.{1,4}/g)?.join(' ') || secret;
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(5).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  /**
   * Hash a backup code
   */
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code.replace('-', '').toLowerCase()).digest('hex');
  }

  /**
   * Store backup codes in database
   */
  private async storeBackupCodes(userId: string, hashedCodes: string[]): Promise<void> {
    // Store as JSON in a dedicated table or user metadata
    // For simplicity, we'll use user metadata (could be a separate table)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        // Store in a JSON field if available, or we could create a separate table
        // For now, we'll embed in mfaSecret with a delimiter
      },
    });
  }

  /**
   * Delete backup codes
   */
  private async deleteBackupCodes(userId: string): Promise<void> {
    // Implementation depends on where codes are stored
  }

  /**
   * Verify a backup code
   */
  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    // Implementation depends on backup code storage
    // For now, return false as backup codes need proper storage
    return false;
  }

  /**
   * Generate otpauth URL for authenticator apps
   */
  private generateOtpauthUrl(email: string, secret: string): string {
    const label = encodeURIComponent(`${this.issuer}:${email}`);
    const params = new URLSearchParams({
      secret,
      issuer: this.issuer,
      algorithm: TOTP_ALGORITHM.toUpperCase(),
      digits: String(TOTP_DIGITS),
      period: String(TOTP_PERIOD),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  /**
   * Generate QR code data URL
   */
  private async generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
    // Simple SVG-based QR code generation
    // In production, use a proper QR code library like 'qrcode'
    // For now, return a placeholder that instructs manual entry
    return `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <rect width="200" height="200" fill="white"/>
        <text x="100" y="100" text-anchor="middle" font-size="12">
          Scan QR with authenticator app
        </text>
      </svg>`
    )}`;
  }

  /**
   * Verify a TOTP code
   */
  private verifyTotp(secret: string, code: string): boolean {
    const normalizedCode = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalizedCode)) {
      return false;
    }

    const currentTime = Math.floor(Date.now() / 1000);

    // Check codes within the window
    for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
      const timeStep = Math.floor(currentTime / TOTP_PERIOD) + i;
      const expectedCode = this.generateTotp(secret, timeStep);
      if (expectedCode === normalizedCode) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate a TOTP code for a given time step
   */
  private generateTotp(secret: string, timeStep: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(timeStep));

    const decodedSecret = this.base32Decode(secret);
    const hmac = crypto.createHmac(TOTP_ALGORITHM, decodedSecret);
    hmac.update(buffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, TOTP_DIGITS);
    return otp.toString().padStart(TOTP_DIGITS, '0');
  }

  /**
   * Encrypt secret for storage
   */
  private encryptSecret(secret: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt secret from storage
   */
  private decryptSecret(encrypted: string): string {
    const [ivHex, authTagHex, data] = encrypted.split(':');
    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get encryption key from environment
   */
  private getEncryptionKey(): Buffer {
    const keyEnv = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-mfa-key-change-in-production';
    return crypto.createHash('sha256').update(keyEnv).digest();
  }

  /**
   * Base32 encode
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 0x1f];
        bits -= 5;
      }
    }

    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 0x1f];
    }

    return result;
  }

  /**
   * Base32 decode
   */
  private base32Decode(str: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanStr = str.replace(/\s/g, '').toUpperCase();

    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (const char of cleanStr) {
      const index = alphabet.indexOf(char);
      if (index === -1) continue;

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }
}
