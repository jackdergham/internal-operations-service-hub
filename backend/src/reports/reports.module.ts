import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { DirectoryModule } from '../directory/directory.module.js';
import { PrismaModule } from '../prisma.module.js';

@Module({
  imports: [PrismaModule, DirectoryModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
