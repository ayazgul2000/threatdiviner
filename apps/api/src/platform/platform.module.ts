import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';
import { PlatformStatsController } from './platform-stats.controller';
import { PlatformStatsService } from './platform-stats.service';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET') || 'platform-admin-secret',
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [
    PlatformAuthController,
    PlatformTenantsController,
    PlatformConfigController,
    PlatformStatsController,
  ],
  providers: [
    PlatformAuthService,
    PlatformTenantsService,
    PlatformConfigService,
    PlatformStatsService,
    PlatformAdminGuard,
  ],
  exports: [
    PlatformAuthService,
    PlatformTenantsService,
    PlatformConfigService,
    PlatformStatsService,
  ],
})
export class PlatformModule {}
