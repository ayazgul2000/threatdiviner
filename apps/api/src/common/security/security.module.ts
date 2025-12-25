import { Global, Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { SanitizeService } from './sanitize.service';
import { SecurityMiddleware } from './security.middleware';

@Global()
@Module({
  providers: [SanitizeService],
  exports: [SanitizeService],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware)
      .forRoutes('*');
  }
}
