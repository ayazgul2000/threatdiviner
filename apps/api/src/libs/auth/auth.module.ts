import {
  Module,
  DynamicModule,
  MiddlewareConsumer,
  NestModule,
  Provider,
  Global,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { PermissionsGuard } from './permissions/permissions.guard';
import { AltanicheAuthConfig } from './interfaces';
import { AUTH_CONFIG } from './auth.constants';

// Extended auth services
import { PasswordResetService } from './services/password-reset.service';
import { EmailVerificationService } from './services/email-verification.service';
import { MfaService } from './services/mfa.service';
import { SessionService } from './services/session.service';

export interface AuthModuleOptions {
  /**
   * If true, registers the auth controller
   * @default true
   */
  useController?: boolean;

  /**
   * Configuration for the auth module
   */
  config: AltanicheAuthConfig;
}

export interface AuthModuleAsyncOptions {
  /**
   * If true, registers the auth controller
   * @default true
   */
  useController?: boolean;

  /**
   * Imports required for the factory
   */
  imports?: any[];

  /**
   * Dependencies to inject into factory
   */
  inject?: any[];

  /**
   * Factory function to create config
   */
  useFactory: (...args: any[]) => Promise<AltanicheAuthConfig> | AltanicheAuthConfig;
}

/**
 * Altaniche Auth Module
 */
@Global()
@Module({})
export class AuthModule implements NestModule {
  private static config: AltanicheAuthConfig;

  /**
   * Register the auth module synchronously
   */
  static register(options: AuthModuleOptions): DynamicModule {
    AuthModule.config = options.config;

    const providers: Provider[] = [
      {
        provide: AUTH_CONFIG,
        useValue: options.config,
      },
      AuthService,
      JwtStrategy,
      PermissionsGuard,
      // Extended auth services
      PasswordResetService,
      EmailVerificationService,
      MfaService,
      SessionService,
    ];

    if (options.config.multiTenant !== false && options.config.setTenantContext) {
      providers.push(TenantMiddleware);
    }

    return {
      module: AuthModule,
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: options.config.jwtSecret,
          signOptions: {
            expiresIn: (options.config.accessTokenExpiry || '15m') as any,
          },
        }),
      ],
      controllers: options.useController !== false ? [AuthController] : [],
      providers,
      exports: [
        AuthService,
        JwtModule,
        AUTH_CONFIG,
        PermissionsGuard,
        PasswordResetService,
        EmailVerificationService,
        MfaService,
        SessionService,
      ],
    };
  }

  /**
   * Register the auth module asynchronously
   */
  static registerAsync(options: AuthModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: AUTH_CONFIG,
      inject: options.inject || [],
      useFactory: async (...args: any[]) => {
        const config = await options.useFactory(...args);
        AuthModule.config = config;
        return config;
      },
    };

    // Custom JwtService provider that gets config from AUTH_CONFIG
    const jwtServiceProvider: Provider = {
      provide: JwtService,
      inject: [AUTH_CONFIG],
      useFactory: (config: AltanicheAuthConfig) => {
        return new JwtService({
          secret: config.jwtSecret,
          signOptions: {
            expiresIn: (config.accessTokenExpiry || '15m') as any,
          },
        });
      },
    };

    return {
      module: AuthModule,
      imports: [
        ...(options.imports || []),
        PassportModule.register({ defaultStrategy: 'jwt' }),
      ],
      controllers: options.useController !== false ? [AuthController] : [],
      providers: [
        configProvider,
        jwtServiceProvider,
        AuthService,
        JwtStrategy,
        TenantMiddleware,
        PermissionsGuard,
        // Extended auth services
        PasswordResetService,
        EmailVerificationService,
        MfaService,
        SessionService,
      ],
      exports: [
        AuthService,
        JwtService,
        AUTH_CONFIG,
        PermissionsGuard,
        PasswordResetService,
        EmailVerificationService,
        MfaService,
        SessionService,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    if (AuthModule.config?.multiTenant !== false && AuthModule.config?.setTenantContext) {
      const excludedRoutes = AuthModule.config.excludedRoutes || ['auth/(.*)', 'health'];
      consumer
        .apply(TenantMiddleware)
        .exclude(...excludedRoutes)
        .forRoutes('*');
    }
  }
}
