import { Module } from '@nestjs/common';
import { IntakeController } from './intake.controller.js';
import { IntakeService } from './intake.service.js';
import { RoutingModule } from '../routing/routing.module.js';
import { LocalRequestAssistProvider } from './local-request-assist.provider.js';
import { RequestAssistService } from './request-assist.service.js';
import { GeminiRequestAssistProvider } from './gemini-request-assist.provider.js';
import { REQUEST_ASSIST_PROVIDER } from './request-assist.service.js';

@Module({
  imports: [RoutingModule],
  controllers: [IntakeController],
  providers: [
    IntakeService,
    RequestAssistService,
    LocalRequestAssistProvider,
    GeminiRequestAssistProvider,
    {
      provide: REQUEST_ASSIST_PROVIDER,
      inject: [GeminiRequestAssistProvider, LocalRequestAssistProvider],
      useFactory: (
        geminiProvider: GeminiRequestAssistProvider,
        localProvider: LocalRequestAssistProvider,
      ) => process.env.AI_PROVIDER === 'gemini' ? geminiProvider : localProvider,
    },
  ],
})
export class IntakeModule {}
