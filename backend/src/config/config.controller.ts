import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ConfigService } from './config.service.js';
import type { RequestTypeConfigInput } from './config.types.js';
import { RequireKnownActorGuard } from '../directory/require-known-actor.guard.js';
import { CurrentActor } from '../directory/current-actor.decorator.js';
import type { Actor } from '../directory/directory.types.js';

@Controller('admin/config')
@UseGuards(RequireKnownActorGuard)
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('request-types')
  listRequestTypes(@CurrentActor() actor: Actor) {
    return this.configService.listRequestTypes(actor);
  }

  @Get('request-types/:requestTypeId/versions')
  listVersions(@CurrentActor() actor: Actor, @Param('requestTypeId') requestTypeId: string) {
    return this.configService.getWorkflowVersions(actor, requestTypeId);
  }

  @Put('request-types/:requestTypeId')
  saveRequestType(
    @CurrentActor() actor: Actor,
    @Param('requestTypeId') requestTypeId: string,
    @Body() body: Omit<RequestTypeConfigInput, 'id'>,
  ) {
    return this.configService.upsertRequestType(actor, { ...body, id: requestTypeId });
  }

  @Post('request-types/:requestTypeId/publish')
  publishRequestType(@CurrentActor() actor: Actor, @Param('requestTypeId') requestTypeId: string) {
    return this.configService.publishRequestType(actor, requestTypeId);
  }
}
