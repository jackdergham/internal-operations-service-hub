import { Module } from '@nestjs/common';
import { FulfillmentController } from './fulfillment.controller.js';
import { FulfillmentService } from './fulfillment.service.js';
import { DirectoryModule } from '../directory/directory.module.js';
import { PrismaModule } from '../prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, DirectoryModule, NotificationsModule],
  controllers: [FulfillmentController],
  providers: [FulfillmentService],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
