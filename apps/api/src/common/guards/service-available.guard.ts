import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ServiceAvailableGuard implements CanActivate {
  private readonly logger = new Logger(ServiceAvailableGuard.name);
  private lastCheckTime = 0;
  private lastCheckResult = true;
  private readonly cacheDuration = 5000; // 5 seconds cache

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    // Use cached result if recent
    const now = Date.now();
    if (now - this.lastCheckTime < this.cacheDuration) {
      if (!this.lastCheckResult) {
        throw new ServiceUnavailableException('Database unavailable');
      }
      return true;
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.lastCheckResult = true;
      this.lastCheckTime = now;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      this.lastCheckResult = false;
      this.lastCheckTime = now;
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
