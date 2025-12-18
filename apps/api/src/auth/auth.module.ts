import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule as AltanicheAuthModule } from '@altaniche/auth';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository, TenantRepository } from './repositories';

@Module({
  imports: [
    PrismaModule,
    AltanicheAuthModule.registerAsync({
      imports: [ConfigModule, PrismaModule],
      inject: [ConfigService, PrismaService],
      useFactory: (config: ConfigService, prisma: PrismaService) => {
        // Create repository instances directly
        const userRepo = new UserRepository(prisma);
        const tenantRepo = new TenantRepository(prisma);

        return {
          jwtSecret: config.get('JWT_SECRET', 'threatdiviner-dev-secret-change-in-production'),
          jwtRefreshSecret: config.get('JWT_REFRESH_SECRET', 'threatdiviner-refresh-secret-change-in-production'),
          accessTokenExpiry: config.get('JWT_EXPIRATION', '15m'),
          refreshTokenExpiry: config.get('JWT_REFRESH_EXPIRATION', '7d'),
          multiTenant: true,
          userRepository: userRepo,
          tenantRepository: tenantRepo,
          setTenantContext: async (tenantId: string) => {
            await prisma.setTenantContext(tenantId);
          },
        };
      },
    }),
  ],
  exports: [AltanicheAuthModule],
})
export class AuthModule {}
