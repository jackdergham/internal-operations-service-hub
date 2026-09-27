import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FulfillmentService } from './fulfillment.service.js';
import type { AddCommentInput, ReassignInput } from './fulfillment.types.js';
import { RequireKnownActorGuard } from '../directory/require-known-actor.guard.js';
import { CurrentActor } from '../directory/current-actor.decorator.js';
import type { Actor } from '../directory/directory.types.js';

@Controller('fulfillment')
@UseGuards(RequireKnownActorGuard)
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Get('queue')
  listQueue(@CurrentActor() actor: Actor) {
    return this.fulfillmentService.listQueue(actor);
  }

  @Post(':requestId/assign')
  assignToSelf(@Param('requestId') requestId: string, @CurrentActor() actor: Actor) {
    return this.fulfillmentService.assignToSelf(requestId, actor);
  }

  @Post(':requestId/reassign')
  reassign(
    @Param('requestId') requestId: string,
    @CurrentActor() actor: Actor,
    @Body() body: ReassignInput,
  ) {
    return this.fulfillmentService.reassign(requestId, actor, body?.queue);
  }

  @Post(':requestId/comments')
  addComment(
    @Param('requestId') requestId: string,
    @CurrentActor() actor: Actor,
    @Body() body: AddCommentInput,
  ) {
    return this.fulfillmentService.addComment(requestId, actor, body);
  }

  @Get(':requestId/comments')
  listComments(@Param('requestId') requestId: string, @CurrentActor() actor: Actor) {
    return this.fulfillmentService.listComments(requestId, actor);
  }

  @Post(':requestId/resolve')
  resolve(@Param('requestId') requestId: string, @CurrentActor() actor: Actor) {
    return this.fulfillmentService.resolve(requestId, actor);
  }

  @Post(':requestId/close')
  close(@Param('requestId') requestId: string, @CurrentActor() actor: Actor) {
    return this.fulfillmentService.close(requestId, actor);
  }
}
