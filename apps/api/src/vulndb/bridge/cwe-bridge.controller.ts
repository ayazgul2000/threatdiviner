import { Controller, Get, Param, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../libs/auth/guards/jwt-auth.guard';
import { CweBridgeResolutionService } from './cwe-bridge-resolution.service';

@Controller('vulndb/bridge')
@UseGuards(JwtAuthGuard)
export class CweBridgeController {
  constructor(private readonly resolutionService: CweBridgeResolutionService) {}

  @Get('resolve/:iconName')
  async resolveIcon(@Param('iconName') iconName: string) {
    if (!iconName || iconName.trim().length === 0) {
      throw new HttpException('Icon name is required', HttpStatus.BAD_REQUEST);
    }
    return this.resolutionService.resolve(iconName);
  }

  @Get('category/:category')
  async resolveCategory(@Param('category') category: string) {
    if (!category || category.trim().length === 0) {
      throw new HttpException('Category is required', HttpStatus.BAD_REQUEST);
    }
    return this.resolutionService.resolveCategory(category);
  }

  @Get('categories')
  async getCategories() {
    return this.resolutionService.getCategories();
  }

  @Get('icons')
  async getKnownIcons() {
    return this.resolutionService.getKnownIcons();
  }

  @Get('stats')
  async getStats() {
    return this.resolutionService.getStats();
  }
}
