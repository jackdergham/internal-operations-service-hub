import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RequestAssistService } from './request-assist.service.js';
import type {
  AssistRequestSuggestion,
  RequestAssistProvider,
} from './request-assist.types.js';

const suggestion: AssistRequestSuggestion = {
  requestTypeId: 'new-laptop',
  formData: {},
  missingFields: [],
  warnings: [],
  confidence: 'high',
  source: 'gemini',
};

describe('RequestAssistService', () => {
  it('returns the provider suggestion for the authorized requester', async () => {
    const provider: RequestAssistProvider = {
      suggest: vi.fn().mockResolvedValue(suggestion),
    };
    const service = new RequestAssistService(provider);

    await expect(service.assist('employee-1', {
      requesterId: 'employee-1',
      description: 'I need a laptop for engineering work.',
    })).resolves.toEqual(suggestion);
    expect(provider.suggest).toHaveBeenCalledWith('I need a laptop for engineering work.');
  });

  it('rejects an actor mismatch before calling the provider', async () => {
    const provider: RequestAssistProvider = { suggest: vi.fn() };
    const service = new RequestAssistService(provider);

    await expect(service.assist('employee-2', {
      requesterId: 'employee-1',
      description: 'I need a laptop for engineering work.',
    })).rejects.toThrow(ForbiddenException);
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it('rejects descriptions shorter than the intake minimum', async () => {
    const provider: RequestAssistProvider = { suggest: vi.fn() };
    const service = new RequestAssistService(provider);

    await expect(service.assist('employee-1', {
      requesterId: 'employee-1',
      description: 'Need help',
    })).rejects.toThrow(BadRequestException);
    expect(provider.suggest).not.toHaveBeenCalled();
  });
});
