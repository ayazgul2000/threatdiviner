import { TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export interface TestApp {
  app: INestApplication;
  module: TestingModule;
}

export const createTestApp = async (module: TestingModule): Promise<INestApplication> => {
  const app = module.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();
  return app;
};

// Global test timeout
jest.setTimeout(30000);

// Clean up any test data
afterAll(async () => {
  // Add cleanup logic here if needed
});
