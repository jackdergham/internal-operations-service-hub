import type {
  RequestAssistProvider,
  AssistRequestSuggestion,
} from './request-assist.types.js';

const requestTypeRules = [
  {
    id: 'new-laptop',
    keywords: ['laptop', 'computer', 'workstation', 'equipment', 'monitor'],
    requiredFields: ['department'],
  },
  {
    id: 'pto-request',
    keywords: ['pto', 'leave', 'vacation', 'holiday', 'annual leave'],
    requiredFields: ['department', 'startDate', 'endDate'],
  },
  {
    id: 'desk-relocation',
    keywords: ['desk', 'relocate', 'relocation', 'workspace', 'office'],
    requiredFields: ['department', 'newLocation'],
  },
] as const;

export class LocalRequestAssistProvider implements RequestAssistProvider {
  async suggest(description: string): Promise<AssistRequestSuggestion> {
    const normalizedDescription = description.toLowerCase();
    const matches = requestTypeRules.filter((rule) =>
      rule.keywords.some((keyword) => normalizedDescription.includes(keyword)),
    );

    if (matches.length === 0) {
      return {
        requestTypeId: null,
        formData: {},
        missingFields: [],
        warnings: ['The request type could not be identified.'],
        confidence: 'low',
        source: 'local',
      };
    }

    const selectedRule = matches[0];
    const formData: Record<string, unknown> = {};
    const departmentMatch = description.match(/\b(?:in|from|for)\s+([A-Za-z]+)\s+(?:department|team)\b/i);
    const locationMatch = description.match(/\b(?:to|at)\s+the\s+([A-Za-z0-9 -]+?)(?:\.|,|$)/i);

    if (departmentMatch) formData.department = departmentMatch[1];
    if (locationMatch && selectedRule.id === 'desk-relocation') formData.newLocation = locationMatch[1].trim();

    const missingFields = selectedRule.requiredFields.filter((field) => formData[field] === undefined);
    const warnings = matches.length > 1
      ? ['More than one request type matched. Review the suggested request type.']
      : [];

    return {
      requestTypeId: selectedRule.id,
      formData,
      missingFields,
      warnings,
      confidence: matches.length === 1 ? 'medium' : 'low',
      source: 'local',
    };
  }
}
