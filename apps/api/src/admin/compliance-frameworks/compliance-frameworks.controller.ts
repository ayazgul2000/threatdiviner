import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ComplianceFrameworksService } from './compliance-frameworks.service';
import {
  CreateComplianceFrameworkDto,
  UpdateComplianceFrameworkDto,
  CreateComplianceControlDto,
  UpdateComplianceControlDto,
  AddRiskMappingDto,
  ImportFrameworkDto,
  ComplianceFrameworkListQuery,
  ComplianceControlListQuery,
} from './dto/compliance-framework.dto';
import { PlatformAdminGuard } from '../../platform/guards/platform-admin.guard';

@Controller('admin/compliance-frameworks')
@UseGuards(PlatformAdminGuard)
export class ComplianceFrameworksController {
  constructor(private readonly service: ComplianceFrameworksService) {}

  // Framework endpoints
  @Get()
  async listFrameworks(@Query() query: ComplianceFrameworkListQuery) {
    return this.service.listFrameworks(query);
  }

  @Get(':id')
  async getFramework(@Param('id') id: string) {
    const framework = await this.service.getFrameworkById(id);
    return { framework };
  }

  @Post()
  async createFramework(@Body() dto: CreateComplianceFrameworkDto) {
    const framework = await this.service.createFramework(dto);
    return { framework };
  }

  @Put(':id')
  async updateFramework(
    @Param('id') id: string,
    @Body() dto: UpdateComplianceFrameworkDto,
  ) {
    const framework = await this.service.updateFramework(id, dto);
    return { framework };
  }

  @Delete(':id')
  async deleteFramework(@Param('id') id: string) {
    return this.service.deleteFramework(id);
  }

  // Control endpoints
  @Get(':frameworkId/controls')
  async listControls(
    @Param('frameworkId') frameworkId: string,
    @Query() query: ComplianceControlListQuery,
  ) {
    return this.service.listControls(frameworkId, query);
  }

  @Get(':frameworkId/controls/tree')
  async getControlTree(@Param('frameworkId') frameworkId: string) {
    const controls = await this.service.getControlTree(frameworkId);
    return { controls };
  }

  @Get(':frameworkId/controls/categories')
  async getCategories(@Param('frameworkId') frameworkId: string) {
    const categories = await this.service.getCategories(frameworkId);
    return { categories };
  }

  @Get(':frameworkId/controls/:controlId')
  async getControl(
    @Param('frameworkId') frameworkId: string,
    @Param('controlId') controlId: string,
  ) {
    const control = await this.service.getControlById(frameworkId, controlId);
    return { control };
  }

  @Post(':frameworkId/controls')
  async createControl(
    @Param('frameworkId') frameworkId: string,
    @Body() dto: CreateComplianceControlDto,
  ) {
    const control = await this.service.createControl(frameworkId, dto);
    return { control };
  }

  @Put(':frameworkId/controls/:controlId')
  async updateControl(
    @Param('frameworkId') frameworkId: string,
    @Param('controlId') controlId: string,
    @Body() dto: UpdateComplianceControlDto,
  ) {
    const control = await this.service.updateControl(frameworkId, controlId, dto);
    return { control };
  }

  @Delete(':frameworkId/controls/:controlId')
  async deleteControl(
    @Param('frameworkId') frameworkId: string,
    @Param('controlId') controlId: string,
  ) {
    return this.service.deleteControl(frameworkId, controlId);
  }

  // Risk mapping endpoints
  @Get('controls/:controlId/mappings')
  async getRiskMappings(@Param('controlId') controlId: string) {
    const mappings = await this.service.getRiskMappings(controlId);
    return { mappings };
  }

  @Post('controls/:controlId/mappings')
  async addRiskMapping(
    @Param('controlId') controlId: string,
    @Body() dto: AddRiskMappingDto,
  ) {
    const mapping = await this.service.addRiskMapping(controlId, dto);
    return { mapping };
  }

  @Delete('controls/:controlId/mappings/:mappingId')
  async removeRiskMapping(
    @Param('controlId') controlId: string,
    @Param('mappingId') mappingId: string,
  ) {
    return this.service.removeRiskMapping(controlId, mappingId);
  }

  // Bulk import
  @Post('import')
  async bulkImport(@Body() dto: ImportFrameworkDto) {
    return this.service.bulkImport(dto);
  }

  // Stats
  @Get(':frameworkId/mappings-count')
  async getMappingsCount(@Param('frameworkId') frameworkId: string) {
    const count = await this.service.getMappingsCount(frameworkId);
    return { count };
  }
}
