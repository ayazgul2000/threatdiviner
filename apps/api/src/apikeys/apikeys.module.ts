import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../libs/auth';
import { ApiKeysController } from './apikeys.controller';
import { ApiKeysService } from './apikeys.service';
import { ApiKeyAuthGuard, JwtOrApiKeyAuthGuard } from './apikey-auth.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyAuthGuard, JwtOrApiKeyAuthGuard],
  exports: [ApiKeysService, ApiKeyAuthGuard, JwtOrApiKeyAuthGuard],
})
export class ApiKeysModule {}
