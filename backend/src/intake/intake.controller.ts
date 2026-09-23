import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { IntakeService } from './intake.service.js';
import type { CreateRequestInput } from './intake.types.js';
import { RequestAssistService } from './request-assist.service.js';
import type { AssistRequestInput } from './request-assist.types.js';

@Controller()
export class IntakeController {
  constructor(
    private readonly intakeService: IntakeService,
    private readonly requestAssistService: RequestAssistService,
  ) {}

  @Get('request-types')
  listRequestTypes() {
    return this.intakeService.listRequestTypes();
  }

  @Post('requests/assist')
  assistRequest(
    @Headers('x-actor-id') actorId: string | undefined,
    @Body() input: AssistRequestInput,
  ) {
    return this.requestAssistService.assist(actorId, input);
  }

  @Post('requests')
  createRequest(
    @Headers('x-actor-id') actorId: string | undefined,
    @Body() input: CreateRequestInput,
  ) {
    return this.intakeService.createRequest(actorId, input);
  }
}
