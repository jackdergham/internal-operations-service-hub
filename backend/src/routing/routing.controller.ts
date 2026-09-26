import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RoutingService } from './routing.service.js';
import type { DecideApprovalRequestBody } from './routing.types.js';
import { RequireKnownActorGuard } from '../directory/require-known-actor.guard.js';
import { CurrentActor } from '../directory/current-actor.decorator.js';
import type { Actor } from '../directory/directory.types.js';

@Controller('routing-decisions')
@UseGuards(RequireKnownActorGuard)
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Get('queue')
  listQueue(@CurrentActor() actor: Actor) {
    return this.routingService.listQueue(actor.employeeId);
  }

  @Post(':decisionId/steps/:stepId/decision')
  async decideApproval(
    @Param('decisionId') decisionId: string,
    @Param('stepId') stepId: string,
    @CurrentActor() actor: Actor,
    @Body() body: DecideApprovalRequestBody,
  ) {
    return this.routingService.decideApproval(decisionId, stepId, {
      approverId: actor.employeeId,
      ...body,
    });
  }
}
