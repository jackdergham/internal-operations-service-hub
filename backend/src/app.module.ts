import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RoutingModule } from './routing/routing.module.js';
import { IntakeModule } from './intake/intake.module.js';
import { PrismaModule } from './prisma.module.js';

@Module({
  imports: [PrismaModule, IntakeModule, RoutingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
