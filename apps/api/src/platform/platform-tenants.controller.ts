import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformAdminGuard } from './guards/platform-admin.guard';

interface CreateTenantDto {
  name: string;
  slug: string;
  plan?: 'free' | 'pro' | 'enterprise';
}

interface UpdateTenantDto {
  name?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  maxUsers?: number;
  maxRepositories?: number;
  aiTriageEnabled?: boolean;
  isActive?: boolean;
}

@Controller('platform/tenants')
@UseGuards(PlatformAdminGuard)
export class PlatformTenantsController {
  constructor(private readonly tenantsService: PlatformTenantsService) {}

  @Get()
  async list() {
    return this.tenantsService.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.tenantsService.get(id);
  }

  @Post()
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.tenantsService.delete(id);
  }
}
