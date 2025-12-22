import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

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

  console.log(`ThreatDiviner API running on port ${port}`);
  console.log(`API Documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
