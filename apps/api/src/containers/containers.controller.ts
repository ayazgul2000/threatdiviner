import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { ContainerRegistryService, RegistryCredentials } from './container-registry.service';

export interface PullImageDto {
  imageRef: string;
  credentials?: RegistryCredentials;
}

export interface ScanImageDto {
  imageRef: string;
  credentials?: RegistryCredentials;
}

export interface VerifyImageDto {
  imageRef: string;
  expectedDigest?: string;
  credentials?: RegistryCredentials;
}

@Controller('containers')
@UseGuards(JwtAuthGuard)
export class ContainersController {
  constructor(private readonly registryService: ContainerRegistryService) {}

  @Post('info')
  @HttpCode(HttpStatus.OK)
  async getImageInfo(@Body() dto: PullImageDto) {
    return this.registryService.getImageInfo(dto.imageRef, dto.credentials);
  }

  @Get('info/:imageRef')
  async getImageInfoGet(@Param('imageRef') imageRef: string) {
    // URL decode the image reference
    const decoded = decodeURIComponent(imageRef);
    return this.registryService.getImageInfo(decoded);
  }

  @Post('tags')
  @HttpCode(HttpStatus.OK)
  async listTags(@Body() dto: { repository: string; credentials?: RegistryCredentials }) {
    return this.registryService.listTags(dto.repository, dto.credentials);
  }

  @Post('layers')
  @HttpCode(HttpStatus.OK)
  async getLayerInfo(@Body() dto: PullImageDto) {
    return this.registryService.pullLayerInfo(dto.imageRef, dto.credentials);
  }

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  async scanImage(@Body() dto: ScanImageDto) {
    return this.registryService.scanImage(dto.imageRef, dto.credentials);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyImage(@Body() dto: VerifyImageDto) {
    return this.registryService.verifyImage(dto.imageRef, dto.expectedDigest, dto.credentials);
  }

  @Get('registries')
  getSupportedRegistries() {
    return {
      registries: [
        {
          type: 'docker_hub',
          name: 'Docker Hub',
          registry: 'registry-1.docker.io',
          authUrl: 'https://auth.docker.io/token',
          public: true,
        },
        {
          type: 'ghcr',
          name: 'GitHub Container Registry',
          registry: 'ghcr.io',
          authMethod: 'token',
          public: true,
        },
        {
          type: 'gcr',
          name: 'Google Container Registry',
          registry: 'gcr.io',
          authMethod: 'service_account',
          public: false,
        },
        {
          type: 'ecr',
          name: 'Amazon ECR',
          registry: '<account>.dkr.ecr.<region>.amazonaws.com',
          authMethod: 'aws_credentials',
          public: false,
        },
        {
          type: 'acr',
          name: 'Azure Container Registry',
          registry: '<registry>.azurecr.io',
          authMethod: 'service_principal',
          public: false,
        },
        {
          type: 'quay',
          name: 'Quay.io',
          registry: 'quay.io',
          authMethod: 'token',
          public: true,
        },
      ],
      features: [
        'Pull image metadata',
        'List repository tags',
        'Get layer information',
        'Vulnerability scanning',
        'Image digest verification',
      ],
    };
  }
}
