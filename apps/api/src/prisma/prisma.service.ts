import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Set the tenant context for RLS policies
   * This must be called at the start of each request
   *
   * SECURITY: Uses parameterized query to prevent SQL injection
   */
  async setTenantContext(tenantId: string): Promise<void> {
    // Validate tenantId is a valid UUID to prevent injection
    if (!tenantId || !UUID_REGEX.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }
    await this.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, false)`;
  }

  /**
   * Clear tenant context (for logout/cleanup)
   */
  async clearTenantContext(): Promise<void> {
    await this.$executeRaw`SELECT set_config('app.tenant_id', '', false)`;
  }
}
