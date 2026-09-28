import { Module } from '@nestjs/common'
import { DirectoryModule } from '../directory/directory.module.js'
import { NotificationsController } from './notifications.controller.js'
import { NotificationsService } from './notifications.service.js'

@Module({
  imports: [DirectoryModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}