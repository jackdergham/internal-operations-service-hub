import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { RequireKnownActorGuard } from '../directory/require-known-actor.guard.js';
import { CurrentActor } from '../directory/current-actor.decorator.js';
import type { Actor } from '../directory/directory.types.js';

@Controller('requests')
@UseGuards(RequireKnownActorGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get(':requestId/audit')
  getAudit(@Param('requestId') requestId: string, @CurrentActor() actor: Actor) {
    return this.auditService.getRequestAudit(requestId, actor);
  }
}
