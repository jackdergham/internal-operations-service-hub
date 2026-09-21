import { Module } from '@nestjs/common';
import { IntakeController } from './intake.controller.js';
import { IntakeService } from './intake.service.js';
import { RoutingModule } from '../routing/routing.module.js';

@Module({
  imports: [RoutingModule],
  controllers: [IntakeController],
  providers: [IntakeService],
})
export class IntakeModule {}
