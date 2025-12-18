import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
   */
  async setTenantContext(tenantId: string): Promise<void> {
    await this.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${tenantId}', false)`);
  }

  /**
   * Clear tenant context (for logout/cleanup)
   */
  async clearTenantContext(): Promise<void> {
    await this.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '', false)`);
  }
}
