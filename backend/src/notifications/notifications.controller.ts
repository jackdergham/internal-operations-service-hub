import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { CurrentActor } from '../directory/current-actor.decorator.js'
import { RequireKnownActorGuard } from '../directory/require-known-actor.guard.js'
import type { Actor } from '../directory/directory.types.js'
import { NotificationsService } from './notifications.service.js'

@Controller('notifications')
@UseGuards(RequireKnownActorGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('mine')
  listMine(@CurrentActor() actor: Actor) {
    return this.notificationsService.listForActor(actor.employeeId)
  }

  @Patch(':notificationId/read')
  markRead(@Param('notificationId') notificationId: string, @CurrentActor() actor: Actor) {
    return this.notificationsService.markRead(notificationId, actor.employeeId)
  }
}