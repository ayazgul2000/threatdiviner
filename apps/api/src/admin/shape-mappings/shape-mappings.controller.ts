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
import { ShapeMappingsService } from './shape-mappings.service';
import { CreateShapeMappingDto, UpdateShapeMappingDto, BulkImportDto, ShapeMappingListQuery } from './dto/shape-mapping.dto';
import { PlatformAdminGuard } from '../../platform/guards/platform-admin.guard';

interface AdminRequest {
  platformAdmin: {
    id: string;
    email: string;
    name: string;
    isSuperAdmin: boolean;
  };
}

@Controller('admin/shape-mappings')
@UseGuards(PlatformAdminGuard)
export class ShapeMappingsController {
  constructor(private readonly service: ShapeMappingsService) {}

  @Get()
  async list(@Query() query: ShapeMappingListQuery) {
    return this.service.list(query);
  }

  @Get('categories')
  async getCategories() {
    const categories = await this.service.getCategories();
    return { categories };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const mapping = await this.service.getById(id);
    return { mapping };
  }

  @Post()
  async create(@Req() req: AdminRequest, @Body() dto: CreateShapeMappingDto) {
    const mapping = await this.service.create(dto, req.platformAdmin.id);
    return { mapping };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateShapeMappingDto) {
    const mapping = await this.service.update(id, dto);
    return { mapping };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/submit')
  async submitForReview(@Param('id') id: string) {
    const mapping = await this.service.submitForReview(id);
    return { mapping };
  }

  @Post(':id/approve')
  async approve(@Req() req: AdminRequest, @Param('id') id: string) {
    const mapping = await this.service.approve(id, req.platformAdmin.isSuperAdmin || false);
    return { mapping };
  }

  @Post('import')
  async bulkImport(@Req() req: AdminRequest, @Body() dto: BulkImportDto) {
    return this.service.bulkImport(dto.mappings, req.platformAdmin.id);
  }
}
