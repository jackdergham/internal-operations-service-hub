import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RoutingService } from './routing.service.js';
import type { DecideApprovalInput } from './routing.types.js';

@Controller('routing-decisions')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Get('queue')
  listQueue(@Query('approverId') approverId = 'manager-1') {
    return this.routingService.listQueue(approverId);
  }

  @Post(':decisionId/steps/:stepId/decision')
  async decideApproval(
    @Param('decisionId') decisionId: string,
    @Param('stepId') stepId: string,
    @Body() input: DecideApprovalInput,
  ) {
    return this.routingService.decideApproval(decisionId, stepId, input);
  }
}
