import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Middleware that loads the full tenant object and validates tenant status.
 * Must be applied after authentication middleware.
 *
 * Attaches tenant object to request for use in controllers/services.
 * Rejects requests if tenant is inactive.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = (req as any).user;

    if (user?.tenantId) {
      try {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: {
            id: true,
            name: true,
            isActive: true,
            plan: true,
          },
        });

        if (!tenant) {
          res.status(403).json({ message: 'Tenant not found' });
          return;
        }

        if (!tenant.isActive) {
          res.status(403).json({
            message: 'Tenant suspended or inactive',
          });
          return;
        }

        // Attach tenant to request
        (req as any).tenant = tenant;

        // Set Prisma RLS context
        await this.prisma.setTenantContext(user.tenantId);
      } catch (error) {
        console.error('TenantContextMiddleware error:', error);
        res.status(500).json({ message: 'Failed to load tenant context' });
        return;
      }
    }

    next();
  }
}
