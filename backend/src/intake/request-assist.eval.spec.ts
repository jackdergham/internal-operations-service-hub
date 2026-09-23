import { LocalRequestAssistProvider } from './local-request-assist.provider.js';

type EvaluationCase = {
  name: string;
  description: string;
  requestTypeId: string | null;
  expectedFields: Record<string, unknown>;
  expectedMissingFields?: string[];
};

const cases: EvaluationCase[] = [
  {
    name: 'new laptop with department',
    description: 'I need a new laptop for the Engineering department.',
    requestTypeId: 'new-laptop',
    expectedFields: { department: 'Engineering' },
  },
  {
    name: 'workstation with team wording',
    description: 'Please provide a workstation for the Finance team.',
    requestTypeId: 'new-laptop',
    expectedFields: { department: 'Finance' },
  },
  {
    name: 'PTO with missing dates',
    description: 'I need to request PTO from the HR department.',
    requestTypeId: 'pto-request',
    expectedFields: { department: 'HR' },
    expectedMissingFields: ['startDate', 'endDate'],
  },
  {
    name: 'PTO with ISO dates',
    description: 'Please book PTO for the Engineering department from 2026-10-12 to 2026-10-16.',
    requestTypeId: 'pto-request',
    expectedFields: {
      department: 'Engineering',
      startDate: '2026-10-12',
      endDate: '2026-10-16',
    },
  },
  {
    name: 'PTO with slash dates',
    description: 'I need vacation for the People Operations team from 03/11/2026 to 07/11/2026.',
    requestTypeId: 'pto-request',
    expectedFields: {
      department: 'People Operations',
      startDate: '2026-11-03',
      endDate: '2026-11-07',
    },
  },
  {
    name: 'desk relocation with location',
    description: 'Please relocate my desk for the Operations department to the West Wing.',
    requestTypeId: 'desk-relocation',
    expectedFields: { department: 'Operations', newLocation: 'West Wing' },
  },
  {
    name: 'ambiguous equipment and desk request',
    description: 'I need a desk and a monitor for the IT department.',
    requestTypeId: 'new-laptop',
    expectedFields: { department: 'IT' },
  },
  {
    name: 'unknown request type',
    description: 'I need help understanding an internal policy.',
    requestTypeId: null,
    expectedFields: {},
  },
  {
    name: 'desk relocation without location',
    description: 'I need to relocate my desk from the Facilities department.',
    requestTypeId: 'desk-relocation',
    expectedFields: { department: 'Facilities' },
  },
];

describe('AI request assistance evaluation', () => {
  it.each(cases)('$name', async (testCase) => {
    const provider = new LocalRequestAssistProvider();
    const result = await provider.suggest(testCase.description);

    expect(result.requestTypeId).toBe(testCase.requestTypeId);
    expect(result.formData).toMatchObject(testCase.expectedFields);
    if (testCase.expectedMissingFields) {
      expect(result.missingFields).toEqual(testCase.expectedMissingFields);
    }
  });
});
