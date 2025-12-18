import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'threatdiviner-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
