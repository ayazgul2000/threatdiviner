import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Security headers with helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false, // For Swagger UI
    }),
  );

  // Enable cookie parsing for httpOnly JWT cookies
  app.use(cookieParser());

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable global exception filter for graceful error handling
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable global timeout interceptor (30s default)
  app.useGlobalInterceptors(new TimeoutInterceptor(30000));

  // Enable CORS with credentials for cookies
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Setup Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('ThreatDiviner API')
    .setDescription('Security scanning and vulnerability management API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('scm', 'Source Code Management integration')
    .addTag('scans', 'Security scan operations')
    .addTag('findings', 'Vulnerability findings')
    .addTag('notifications', 'Notification configuration')
    .addTag('team', 'Team management')
    .addTag('audit', 'Audit logging')
    .addTag('reporting', 'Report generation')
    .addTag('platform', 'Platform administration')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`ThreatDiviner API running on port ${port}`);
  logger.log(`API Documentation available at http://localhost:${port}/api/docs`);

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.log(`${signal} received, shutting down gracefully...`);
    try {
      await app.close();
      logger.log('Application closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
  process.exit(1);
});
