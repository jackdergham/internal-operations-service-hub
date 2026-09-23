export interface AssistRequestInput {
  requesterId: string;
  description: string;
}

export interface AssistRequestSuggestion {
  requestTypeId: string | null;
  formData: Record<string, unknown>;
  missingFields: string[];
  warnings: string[];
  confidence: 'high' | 'medium' | 'low';
  source: 'local' | 'gemini';
}

export interface RequestAssistProvider {
  suggest(description: string): Promise<AssistRequestSuggestion>;
}
