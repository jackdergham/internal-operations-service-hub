import { Inject, Injectable } from '@nestjs/common';
import { LocalRequestAssistProvider } from './local-request-assist.provider.js';
import { StructuredLogger } from '../../logging/structured-logger.service.js';
import { APP_ENV } from '../../env/env.module.js';
import type { AppEnv } from '../../env/env.types.js';
import type {
  AssistRequestSuggestion,
  RequestAssistProvider,
} from './request-assist.types.js';

@Injectable()
export class GeminiRequestAssistProvider implements RequestAssistProvider {
  constructor(
    private readonly localProvider: LocalRequestAssistProvider,
    // AppEnv is a type alias, so it carries no runtime token to reflect on.
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly logger: StructuredLogger,
  ) {}

  async suggest(description: string): Promise<AssistRequestSuggestion> {
    const apiKey = this.env.geminiApiKey;
    if (!apiKey) {
      this.logger.info('assist.provider.fallback', {
        provider: 'gemini',
        reason: 'missing_api_key',
        fallback: 'local',
      });
      return this.localProvider.suggest(description);
    }

    let failureReason = 'provider_request_failed';

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.env.geminiModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: this.buildPrompt(description) }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  requestTypeId: { type: 'STRING', nullable: true },
                  formData: { type: 'OBJECT' },
                  missingFields: { type: 'ARRAY', items: { type: 'STRING' } },
                  warnings: { type: 'ARRAY', items: { type: 'STRING' } },
                  confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
                },
                required: ['requestTypeId', 'formData', 'missingFields', 'warnings', 'confidence'],
              },
            },
          }),
        },
      );

      if (!response.ok) {
        failureReason = 'provider_http_error';
        throw new Error(`Gemini request failed with status ${response.status}`);
      }
      const payload = await response.json() as GeminiResponse;
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        failureReason = 'invalid_suggestion';
        throw new Error('Gemini returned no suggestion');
      }

      return this.parseSuggestion(text);
    } catch (error) {
      // The description is user content and the key travels in the query string,
      // so neither is logged here; the sanitizing logger masks the rest.
      this.logger.warn('assist.provider.fallback', {
        provider: 'gemini',
        reason: failureReason,
        fallback: 'local',
        error,
      });

      const fallback = await this.localProvider.suggest(description);
      return {
        ...fallback,
        warnings: ['Gemini assistance was unavailable; local suggestions were used.', ...fallback.warnings],
      };
    }
  }

  private buildPrompt(description: string): string {
    return [
      'Convert the employee request into a candidate internal operations request.',
      'Choose exactly one requestTypeId from: new-laptop, pto-request, desk-relocation, or null.',
      'Use only facts present in the description. Never invent missing values.',
      'For new-laptop there are no additional form fields.',
      'For pto-request required fields are startDate and endDate.',
      'For desk-relocation the required field is newLocation.',
      'Return only the requested JSON object.',
      `Employee description: ${description}`,
    ].join('\n');
  }

  private parseSuggestion(text: string): AssistRequestSuggestion {
    const parsed = JSON.parse(text) as Omit<AssistRequestSuggestion, 'source'>;
    if (!Array.isArray(parsed.formData) && parsed.formData && typeof parsed.formData === 'object'
      && Array.isArray(parsed.missingFields) && Array.isArray(parsed.warnings)
      && ['high', 'medium', 'low'].includes(parsed.confidence)
      && (typeof parsed.requestTypeId === 'string' || parsed.requestTypeId === null)) {
      return { ...parsed, source: 'gemini' };
    }
    throw new Error('Gemini returned an invalid suggestion');
  }
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};
