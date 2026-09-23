import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  AssistRequestInput,
  RequestAssistProvider,
  AssistRequestSuggestion,
} from './request-assist.types.js';

export const REQUEST_ASSIST_PROVIDER = 'REQUEST_ASSIST_PROVIDER';

@Injectable()
export class RequestAssistService {
  constructor(
    @Inject(REQUEST_ASSIST_PROVIDER)
    private readonly provider: RequestAssistProvider,
  ) {}

  async assist(actorId: string | undefined, input: AssistRequestInput): Promise<AssistRequestSuggestion> {
    if (!actorId || actorId !== input?.requesterId) {
      throw new ForbiddenException('x-actor-id must identify the requester');
    }

    if (!input.description || input.description.trim().length < 10) {
      throw new BadRequestException('description must be at least 10 characters');
    }

    return this.provider.suggest(input.description.trim());
  }
}
