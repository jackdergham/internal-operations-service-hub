import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller.js';
import { RoutingService } from './routing.service.js';
import { DirectoryModule } from '../directory/directory.module.js';

@Module({
  imports: [DirectoryModule],
  controllers: [RoutingController],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
