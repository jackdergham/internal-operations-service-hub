import { MiddlewareConsumer, Module } from '@nestjs/common';
import type { NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RoutingModule } from './routing/routing.module.js';
import { IntakeModule } from './intake/intake.module.js';
import { PrismaModule } from './prisma.module.js';
import { FulfillmentModule } from './fulfillment/fulfillment.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ConfigModule } from './config/config.module.js';
import { AuditModule } from './audit/audit.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { HealthModule } from './health/health.module.js';
import { EnvModule } from './env/env.module.js';
import { LoggingModule } from './logging/logging.module.js';
import { RequestIdMiddleware } from './logging/request-id.middleware.js';
import { RequestLoggingInterceptor } from './logging/request-logging.interceptor.js';
import { RequestLoggingExceptionFilter } from './logging/request-logging.exception-filter.js';

@Module({
  imports: [
    PrismaModule,
    EnvModule,
    LoggingModule,
    NotificationsModule,
    IntakeModule,
    RoutingModule,
    FulfillmentModule,
    ConfigModule,
    AuditModule,
    ReportsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    RequestIdMiddleware,
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: APP_FILTER, useClass: RequestLoggingExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
