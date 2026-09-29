import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service.js';

/**
 * Unauthenticated on purpose: a platform health check carries no credentials.
 * Neither endpoint exposes configuration, data, or a connection string.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  liveness() {
    return this.healthService.liveness();
  }

  @Get('ready')
  async readiness(@Res({ passthrough: true }) response: Response) {
    const report = await this.healthService.readiness();
    if (report.status !== 'ready') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
