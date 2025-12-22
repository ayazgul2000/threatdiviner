import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    // Use tenant ID if available, otherwise fall back to IP
    const user = req.user as { tenantId?: string } | undefined;
    const ip = req.ip as string || 'unknown';

    if (user?.tenantId) {
      return `tenant:${user.tenantId}`;
    }

    return `ip:${ip}`;
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
  ): Promise<void> {
    throw new ThrottlerException('Too many requests. Please try again later.');
  }
}
