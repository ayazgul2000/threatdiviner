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
  Request,
} from '@nestjs/common';
import { CanonicalRisksService } from './canonical-risks.service';
import {
  CreateCanonicalRiskDto,
  UpdateCanonicalRiskDto,
  AddSourceMappingDto,
  ImportCanonicalRiskDto,
  CanonicalRiskListQuery,
} from './dto/canonical-risk.dto';
import { JwtAuthGuard } from '../../libs/auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: string;
    tenantId: string;
    isSuperAdmin?: boolean;
  };
}

@Controller('admin/canonical-risks')
@UseGuards(JwtAuthGuard)
export class CanonicalRisksController {
  constructor(private readonly service: CanonicalRisksService) {}

  @Get()
  async list(@Query() query: CanonicalRiskListQuery) {
    const result = await this.service.list(query);
    return result;
  }

  @Get('sources')
  async getSources() {
    const sources = await this.service.getSources();
    return { sources };
  }

  @Get('severities')
  async getSeverities() {
    const severities = await this.service.getSeverities();
    return { severities };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const risk = await this.service.getById(id);
    return { risk };
  }

  @Post()
  async create(
    @Body() dto: CreateCanonicalRiskDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const risk = await this.service.create(dto, req.user.tenantId);
    return { risk };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCanonicalRiskDto,
  ) {
    const risk = await this.service.update(id, dto);
    return { risk };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/sources')
  async addSource(
    @Param('id') riskId: string,
    @Body() dto: AddSourceMappingDto,
  ) {
    const source = await this.service.addSource(riskId, dto);
    return { source };
  }

  @Delete(':id/sources/:sourceId')
  async removeSource(
    @Param('id') riskId: string,
    @Param('sourceId') sourceId: string,
  ) {
    return this.service.removeSource(riskId, sourceId);
  }

  @Post(':id/submit')
  async submitForReview(@Param('id') id: string) {
    const risk = await this.service.submitForReview(id);
    return { risk };
  }

  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const risk = await this.service.approve(id, req.user.isSuperAdmin || false);
    return { risk };
  }

  @Post('import')
  async bulkImport(
    @Body() body: { risks: ImportCanonicalRiskDto[] },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.bulkImport(body.risks, req.user.tenantId);
  }
}
