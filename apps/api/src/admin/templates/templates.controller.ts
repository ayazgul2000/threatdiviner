import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto, TemplateListQuery } from './dto/template.dto';
import { PlatformAdminGuard } from '../../platform/guards/platform-admin.guard';

interface AdminRequest {
  platformAdmin: {
    id: string;
    email: string;
    name: string;
    isSuperAdmin: boolean;
  };
}

@Controller('admin/templates')
@UseGuards(PlatformAdminGuard)
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  async list(@Query() query: TemplateListQuery) {
    return this.service.list(query);
  }

  @Get('categories')
  async getCategories() {
    const categories = await this.service.getCategories();
    return { categories };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const template = await this.service.getById(id);
    return { template };
  }

  @Post()
  async create(@Req() req: AdminRequest, @Body() dto: CreateTemplateDto) {
    const template = await this.service.create(dto, req.platformAdmin.id);
    return { template };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    const template = await this.service.update(id, dto);
    return { template };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/duplicate')
  async duplicate(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() body: { name?: string },
  ) {
    const template = await this.service.duplicate(id, req.platformAdmin.id, body.name);
    return { template };
  }
}
