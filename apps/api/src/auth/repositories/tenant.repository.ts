import { Injectable } from '@nestjs/common';
import { ITenantRepository, ITenant } from '../../libs/auth';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantRepository implements ITenantRepository {
  constructor(private prisma: PrismaService) {}

  async findBySlug(slug: string): Promise<ITenant | null> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    return tenant;
  }

  async findById(id: string): Promise<ITenant | null> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    return tenant;
  }
}
