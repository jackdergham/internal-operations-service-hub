import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller.js';
import { ConfigService } from './config.service.js';
import { DirectoryModule } from '../directory/directory.module.js';

@Module({
  imports: [DirectoryModule],
  controllers: [ConfigController],
  providers: [ConfigService],
})
export class ConfigModule {}
