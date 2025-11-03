// Mock API responses for integration tests

export const mockRunResponse = {
  runId: 'test-run-id-123',
  status: 'pending',
};

export const mockStatusPendingResponse = {
  status: 'running',
  results: [],
  suiteName: 'test-suite',
  model: 'anthropic/claude-3-5-sonnet-20241022',
  systemPrompt: 'You are a helpful assistant.',
  isUpdate: false,
};

export const mockStatusCompletedResponse = {
  status: 'completed',
  suiteName: 'test-suite',
  model: 'anthropic/claude-3-5-sonnet-20241022',
  systemPrompt: 'You are a helpful assistant.',
  isUpdate: false,
  totalTimeMs: 2500,
  results: [
    {
      name: 'simple-math',
      prompt: 'What is 2 + 2?',
      response: '4',
      passed: true,
      checkResults: [
        {
          type: 'string_contains',
          passed: true,
          message: 'Response contains "4"',
        },
        {
          type: 'token_length',
          passed: true,
          message: 'Token count 1 (min: 1, max: 50)',
        },
      ],
    },
  ],
};

export const mockStatusCompletedWithOrCheckResponse = {
  status: 'completed',
  suiteName: 'test-suite',
  model: 'anthropic/claude-3-5-sonnet-20241022',
  systemPrompt: 'You are a helpful assistant.',
  isUpdate: false,
  totalTimeMs: 2500,
  results: [
    {
      name: 'or-check-example',
      prompt: 'What is 2 + 2?',
      response: 'The answer is 4',
      passed: true,
      checkResults: [
        {
          type: 'or',
          passed: true,
          message: 'OR check passed',
          children: [
            {
              type: 'match',
              passed: true,
              message: 'Pattern "*4*" found in response',
            },
            {
              type: 'match',
              passed: false,
              message: 'Pattern "*four*" not found in response',
            },
            {
              type: 'min_tokens',
              passed: true,
              message: 'Token count 5 (min: 1)',
            },
          ],
        },
        {
          type: 'match',
          passed: true,
          message: 'Pattern "*4*" found in response',
        },
        {
          type: 'llm_judge',
          passed: true,
          message: 'PASS',
        },
      ],
    },
  ],
};

export const mockStatusFailedResponse = {
  status: 'failed',
  error: {
    message: 'Evaluation failed due to API error',
  },
  results: [],
};

export const mockListSuitesResponse = {
  suites: [
    {
      name: 'test-suite',
      lastRun: '2024-01-15T10:30:00Z',
      lastEdit: '2024-01-15T09:00:00Z',
      evalCount: 2,
    },
    {
      name: 'another-suite',
      lastRun: null,
      lastEdit: '2024-01-14T15:00:00Z',
      evalCount: 5,
    },
  ],
};

export const mockGetSuiteResponse = {
  suite: {
    name: 'test-suite',
    yamlContent: `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  systemPrompt: You are a helpful assistant.

evaluations:
  - name: simple-math
    prompt: What is 2 + 2?
    checks:
      - type: string_contains
        value: "4"
`,
  },
};

export const mockSaveSuiteResponse = {
  success: true,
  message: 'Suite saved successfully',
};

export const mockUnauthorizedResponse = {
  error: 'Unauthorized: Invalid or missing API key',
};

export const mockServerErrorResponse = {
  error: 'Internal server error',
};

export const mockListRunsResponse = {
  runs: [
    {
      id: 'run-id-1',
      suiteName: 'test-suite',
      status: 'completed',
      createdAt: '2024-01-15T10:30:00Z',
      successRate: 100,
      duration: 2.5,
    },
    {
      id: 'run-id-2',
      suiteName: 'test-suite',
      status: 'completed',
      createdAt: '2024-01-14T10:30:00Z',
      successRate: 80,
      duration: 3.2,
    },
  ],
};

export const mockGetRunResponse = {
  run: {
    id: 'run-id-1',
    suiteName: 'test-suite',
    status: 'completed',
    createdAt: '2024-01-15T10:30:00Z',
    successRate: 100,
    duration: 2.5,
    results: [
      {
        name: 'simple-math',
        prompt: 'What is 2 + 2?',
        response: '4',
        passed: true,
      },
    ],
  },
};
