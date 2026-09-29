import { Global, Module } from '@nestjs/common';
import { StructuredLogger } from './structured-logger.service.js';

@Global()
@Module({
  providers: [StructuredLogger],
  exports: [StructuredLogger],
})
export class LoggingModule {}
