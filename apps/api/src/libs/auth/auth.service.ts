import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  AltanicheAuthConfig,
  JwtPayload,
  TokenPair,
  AuthResponse,
  AuthUser,
} from './interfaces';
import { AUTH_CONFIG } from './auth.constants';
import { LoginDto, RegisterDto } from './dto';

/**
 * Core authentication service
 * Handles login, register, refresh, and profile operations
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    @Inject(AUTH_CONFIG) private config: AltanicheAuthConfig,
  ) {}

  /**
   * Register a new user
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const { userRepository, tenantRepository, multiTenant, bcryptRounds } = this.config;

    let tenantId: string | undefined;
    let tenantSlug: string | undefined;
    let tenantName: string | undefined;

    // Handle multi-tenant registration
    if (multiTenant !== false) {
      if (!dto.tenantSlug) {
        throw new BadRequestException('tenantSlug is required');
      }

      if (!tenantRepository) {
        throw new Error('tenantRepository is required for multi-tenant mode');
      }

      const tenant = await tenantRepository.findBySlug(dto.tenantSlug);
      if (!tenant) {
        throw new NotFoundException(`Tenant '${dto.tenantSlug}' not found`);
      }

      tenantId = tenant.id;
      tenantSlug = tenant.slug;
      tenantName = tenant.name;
    }

    // Check if user already exists
    const existing = await userRepository.findByEmail(dto.email, tenantId);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, bcryptRounds || 10);

    // Create user
    const user = await userRepository.create({
      email: dto.email,
      passwordHash,
      role: dto.role || 'member',
      tenantId,
    });

    // Generate tokens
    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role,
      tenantId,
      tenantSlug,
    );

    this.logger.log(`User registered: ${user.email}${tenantSlug ? ` for tenant ${tenantSlug}` : ''}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId,
        tenantSlug,
        tenantName,
      },
      ...tokens,
    };
  }

  /**
   * Authenticate user
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const { userRepository, tenantRepository, multiTenant } = this.config;

    let tenantId: string | undefined;
    let tenantSlug: string | undefined;
    let tenantName: string | undefined;

    // Handle multi-tenant login
    if (multiTenant !== false) {
      if (!dto.tenantSlug) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!tenantRepository) {
        throw new Error('tenantRepository is required for multi-tenant mode');
      }

      const tenant = await tenantRepository.findBySlug(dto.tenantSlug);
      if (!tenant) {
        throw new UnauthorizedException('Invalid credentials');
      }

      tenantId = tenant.id;
      tenantSlug = tenant.slug;
      tenantName = tenant.name;
    }

    // Find user
    const user = await userRepository.findByEmail(dto.email, tenantId);

    // Timing attack prevention: always do bcrypt compare
    const dummyHash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';
    const passwordToCompare = user?.passwordHash || dummyHash;
    const isValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role,
      tenantId,
      tenantSlug,
    );

    this.logger.log(`User logged in: ${user.email}${tenantSlug ? ` for tenant ${tenantSlug}` : ''}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId,
        tenantSlug,
        tenantName,
      },
      ...tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const { userRepository, tenantRepository, multiTenant } = this.config;

    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.jwtRefreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify user still exists
      const user = await userRepository.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Get tenant info if multi-tenant
      let tenantSlug = payload.tenantSlug;
      if (multiTenant !== false && payload.tenantId && tenantRepository) {
        const tenant = await tenantRepository.findById(payload.tenantId);
        if (tenant) {
          tenantSlug = tenant.slug;
        }
      }

      // Generate new tokens
      return this.generateTokens(
        user.id,
        user.email,
        user.role,
        payload.tenantId,
        tenantSlug,
      );
    } catch (error) {
      this.logger.warn(`Token refresh failed: ${error}`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<AuthUser & { createdAt?: Date }> {
    const { userRepository } = this.config;

    // Try to get user with tenant info
    let user;
    if (userRepository.findByIdWithTenant) {
      user = await userRepository.findByIdWithTenant(userId);
    } else {
      user = await userRepository.findById(userId);
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result: AuthUser & { createdAt?: Date } = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      createdAt: user.createdAt,
    };

    // Add tenant info if available
    if ('tenant' in user && user.tenant) {
      const tenant = user.tenant as { slug?: string; name?: string };
      result.tenantSlug = tenant.slug;
      result.tenantName = tenant.name;
    }

    return result;
  }

  /**
   * Validate password (useful for password change operations)
   */
  async validatePassword(userId: string, password: string): Promise<boolean> {
    const user = await this.config.userRepository.findById(userId);
    if (!user) {
      return false;
    }
    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * Hash password (useful for password change operations)
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds || 10);
  }

  /**
   * Generate access and refresh tokens
   */
  private generateTokens(
    userId: string,
    email: string,
    role: string,
    tenantId?: string,
    tenantSlug?: string,
  ): TokenPair {
    const basePayload = {
      sub: userId,
      email,
      role,
      ...(tenantId && { tenantId }),
      ...(tenantSlug && { tenantSlug }),
    };

    const accessPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      ...basePayload,
      type: 'access',
    };

    const refreshPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      ...basePayload,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload as any, {
      secret: this.config.jwtSecret,
      expiresIn: (this.config.accessTokenExpiry || '15m') as any,
    });

    const refreshToken = this.jwtService.sign(refreshPayload as any, {
      secret: this.config.jwtRefreshSecret,
      expiresIn: (this.config.refreshTokenExpiry || '7d') as any,
    });

    return { accessToken, refreshToken };
  }
}
