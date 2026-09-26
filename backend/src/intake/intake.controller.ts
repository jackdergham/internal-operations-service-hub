import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IntakeService } from './intake.service.js';
import type { CreateRequestInput } from './intake.types.js';
import { RequestAssistService } from './assistance/request-assist.service.js';
import type { AssistRequestInput } from './assistance/request-assist.types.js';
import { RequireKnownActorGuard } from '../directory/require-known-actor.guard.js';
import { CurrentActor } from '../directory/current-actor.decorator.js';
import type { Actor } from '../directory/directory.types.js';

@Controller()
export class IntakeController {
  constructor(
    private readonly intakeService: IntakeService,
    private readonly requestAssistService: RequestAssistService,
  ) {}

  // Unguarded: the request-type catalog isn't tied to an identity, and the
  // frontend fetches it before a user context exists.
  @Get('request-types')
  listRequestTypes() {
    return this.intakeService.listRequestTypes();
  }

  @Post('requests/assist')
  @UseGuards(RequireKnownActorGuard)
  assistRequest(@CurrentActor() actor: Actor, @Body() input: AssistRequestInput) {
    return this.requestAssistService.assist(actor.employeeId, input);
  }

  @Post('requests')
  @UseGuards(RequireKnownActorGuard)
  createRequest(@CurrentActor() actor: Actor, @Body() input: CreateRequestInput) {
    return this.intakeService.createRequest(actor.employeeId, input);
  }
}
