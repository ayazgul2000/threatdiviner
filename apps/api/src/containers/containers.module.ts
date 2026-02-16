import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ContainersController } from './containers.controller';
import { ContainerRegistryService } from './container-registry.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  controllers: [ContainersController],
  providers: [ContainerRegistryService],
  exports: [ContainerRegistryService],
})
export class ContainersModule {}
