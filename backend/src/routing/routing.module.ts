import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller.js';
import { RoutingService } from './routing.service.js';
import { DirectoryModule } from '../directory/directory.module.js';
import { FulfillmentModule } from '../fulfillment/fulfillment.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [DirectoryModule, FulfillmentModule, NotificationsModule],
  controllers: [RoutingController],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
