import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RoutingModule } from './routing/routing.module.js';
import { IntakeModule } from './intake/intake.module.js';
import { PrismaModule } from './prisma.module.js';
import { FulfillmentModule } from './fulfillment/fulfillment.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ReportsModule } from './reports/reports.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule, IntakeModule, RoutingModule, FulfillmentModule, ReportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
