import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { RequireKnownActorGuard } from '../directory/require-known-actor.guard.js';
import { CurrentActor } from '../directory/current-actor.decorator.js';
import type { Actor } from '../directory/directory.types.js';
import type { ReportSummary } from './reports.types.js';

@Controller('reports')
@UseGuards(RequireKnownActorGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary(@CurrentActor() actor: Actor): Promise<ReportSummary> {
    return this.reportsService.buildSummary(actor);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(@CurrentActor() actor: Actor, @Res() response: Response): Promise<void> {
    const csv = await this.reportsService.buildCsv(actor);
    response.setHeader('Content-Disposition', 'attachment; filename="ops-report.csv"');
    response.send(csv);
  }
}
