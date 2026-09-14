import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { IntakeService } from './intake.service.js';
import type { CreateRequestInput } from './intake.types.js';

@Controller()
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Get('request-types')
  listRequestTypes() {
    return this.intakeService.listRequestTypes();
  }

  @Post('requests')
  createRequest(
    @Headers('x-actor-id') actorId: string | undefined,
    @Body() input: CreateRequestInput,
  ) {
    return this.intakeService.createRequest(actorId, input);
  }
}
