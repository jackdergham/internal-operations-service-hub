import { Body, Controller, Param, Post } from '@nestjs/common';
import { RoutingService } from './routing.service.js';
import type { DecideApprovalInput } from './routing.types.js';

@Controller('routing-decisions')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post(':decisionId/steps/:stepId/decision')
  decideApproval(
    @Param('decisionId') decisionId: string,
    @Param('stepId') stepId: string,
    @Body() input: DecideApprovalInput,
  ) {
    return this.routingService.decideApproval(decisionId, stepId, input);
  }
}
