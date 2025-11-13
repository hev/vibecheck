import nock from 'nock';
import {
  mockRunResponse,
  mockStatusPendingResponse,
  mockStatusCompletedResponse,
  mockStatusFailedResponse,
  mockListSuitesResponse,
  mockGetSuiteResponse,
  mockSaveSuiteResponse,
  mockUnauthorizedResponse,
  mockServerErrorResponse,
  mockListRunsResponse,
  mockGetRunResponse,
} from '../fixtures/mock-responses';

const API_URL = process.env.VIBECHECK_API_URL || process.env.API_BASE_URL || process.env.VIBECHECK_URL || 'http://localhost:3000';

export class ApiMock {
  private scope: nock.Scope;

  constructor() {
    this.scope = nock(API_URL);
  }

  mockRunEval(response = mockRunResponse, statusCode = 200) {
    this.scope
      .post('/api/eval/run')
      .reply(statusCode, response);
    return this;
  }

  mockStatusPending(runId: string = 'test-run-id-123') {
    this.scope
      .persist() // Allow multiple polling requests
      .get(`/api/eval/status/${runId}`)
      .reply(200, mockStatusPendingResponse);
    return this;
  }

  mockStatusCompleted(runId: string = 'test-run-id-123') {
    this.scope
      .persist() // Allow multiple polling requests
      .get(`/api/eval/status/${runId}`)
      .reply(200, mockStatusCompletedResponse);
    return this;
  }

  mockStatusFailed(runId: string = 'test-run-id-123') {
    this.scope
      .get(`/api/eval/status/${runId}`)
      .reply(200, mockStatusFailedResponse);
    return this;
  }

  mockListSuites(statusCode = 200) {
    this.scope
      .get('/api/suite/list')
      .reply(statusCode, statusCode === 200 ? mockListSuitesResponse : mockUnauthorizedResponse);
    return this;
  }

  mockGetSuite(name: string, statusCode = 200) {
    this.scope
      .get(`/api/suite/${encodeURIComponent(name)}`)
      .reply(statusCode, statusCode === 200 ? mockGetSuiteResponse : { error: 'Suite not found' });
    return this;
  }

  mockGetSuiteWithResponse(name: string, response: any, statusCode = 200) {
    this.scope
      .get(`/api/suite/${encodeURIComponent(name)}`)
      .reply(statusCode, response);
    return this;
  }

  mockSaveSuite(statusCode = 200) {
    this.scope
      .post('/api/suite/save')
      .reply(statusCode, statusCode === 200 ? mockSaveSuiteResponse : mockUnauthorizedResponse);
    return this;
  }

  mockListRuns(response?: any, statusCode = 200) {
    const defaultResponse = {
      runs: [
        {
          id: 'run-1',
          suite_name: 'test-suite',
          model: 'anthropic/claude-3-5-sonnet',
          status: 'completed',
          results_count: '10',
          evals_passed: '8',
          success_percentage: '80.0',
          duration_seconds: '2.5',
          total_cost: '0.000150',
          total_input_cost: '0.000050',
          total_output_cost: '0.000100',
          total_prompt_tokens: '1000',
          total_completion_tokens: '500',
          total_thinking_tokens: '0',
          total_tokens: '1500',
          created_at: '2024-01-15T10:30:00Z',
          completed_at: '2024-01-15T10:30:05Z'
        },
        {
          id: 'run-2',
          suite_name: 'another-suite',
          model: 'openai/gpt-4o',
          status: 'completed',
          results_count: '5',
          evals_passed: '5',
          success_percentage: '100.0',
          duration_seconds: '1.8',
          total_cost: '0.000100',
          total_input_cost: '0.000030',
          total_output_cost: '0.000070',
          total_prompt_tokens: '600',
          total_completion_tokens: '300',
          total_thinking_tokens: '0',
          total_tokens: '900',
          created_at: '2024-01-14T10:30:00Z',
          completed_at: '2024-01-14T10:30:03Z'
        }
      ],
      pagination: {
        total: 2,
        hasMore: false
      }
    };
    this.scope
      .get('/api/runs')
      .query(true) // Accept any query parameters
      .reply(statusCode, response || (statusCode === 200 ? defaultResponse : mockUnauthorizedResponse));
    return this;
  }

  mockGetRun(runId: string, response?: any, statusCode = 200) {
    const defaultResponse = {
      run: {
        id: runId,
        suite_name: 'test-suite',
        model: 'anthropic/claude-3-5-sonnet',
        status: 'completed',
        results_count: '2',
        evals_passed: '2',
        success_percentage: '100.0',
        duration_seconds: '2.5',
        total_cost: '0.000150',
        total_input_cost: '0.000050',
        total_output_cost: '0.000100',
        total_prompt_tokens: '1000',
        total_completion_tokens: '500',
        total_thinking_tokens: '0',
        total_tokens: '1500',
        created_at: '2024-01-15T10:30:00Z',
        completed_at: '2024-01-15T10:30:05Z',
        results: [
          {
            eval_name: 'simple-math',
            prompt: 'What is 2 + 2?',
            response: 'The answer is 4',
            passed: true,
            prompt_tokens: '500',
            completion_tokens: '250',
            thinking_tokens: '0',
            total_tokens: '750',
            input_cost: '0.000025',
            output_cost: '0.000050',
            cost: '0.000075',
            check_results: [
              {
                type: 'match',
                passed: true,
                message: 'Pattern "*4*" found in response'
              }
            ]
          },
          {
            eval_name: 'greeting',
            prompt: 'Say hello',
            response: 'Hello there!',
            passed: true,
            prompt_tokens: '500',
            completion_tokens: '250',
            thinking_tokens: '0',
            total_tokens: '750',
            input_cost: '0.000025',
            output_cost: '0.000050',
            cost: '0.000075',
            check_results: [
              {
                type: 'match',
                passed: true,
                message: 'Pattern "*hello*" found in response'
              }
            ]
          }
        ]
      }
    };
    this.scope
      .get(`/api/runs/${runId}`)
      .reply(statusCode, response || (statusCode === 200 ? defaultResponse : { error: 'Run not found' }));
    return this;
  }

  mockUnauthorized(endpoint: string) {
    this.scope
      .persist()
      .post(endpoint)
      .reply(401, mockUnauthorizedResponse)
      .get(endpoint)
      .reply(401, mockUnauthorizedResponse);
    return this;
  }

  mockServerError(endpoint: string) {
    this.scope
      .persist()
      .post(endpoint)
      .reply(500, mockServerErrorResponse)
      .get(endpoint)
      .reply(500, mockServerErrorResponse);
    return this;
  }

  // Runtime vars endpoints
  mockVarSet(name: string, value: string, statusCode = 200) {
    this.scope
      .post('/api/runtime/vars', (body: any) => {
        return body.name === name && body.value === value;
      })
      .reply(statusCode, statusCode === 200 ? {} : { error: 'Invalid request' });
    return this;
  }

  mockVarUpdate(name: string, value: string, statusCode = 200) {
    this.scope
      .put(`/api/runtime/vars/${encodeURIComponent(name)}`, (body: any) => {
        return body.value === value;
      })
      .reply(statusCode, statusCode === 200 ? {} : statusCode === 404 ? { error: 'Not found' } : { error: 'Invalid request' });
    return this;
  }

  mockVarGet(name: string, value: string, statusCode = 200) {
    this.scope
      .get(`/api/runtime/vars/${encodeURIComponent(name)}`)
      .reply(statusCode, statusCode === 200 ? { name, value } : { error: 'Not found' });
    return this;
  }

  mockVarList(vars: Array<{ name: string; value: string }>, statusCode = 200) {
    this.scope
      .get('/api/runtime/vars')
      .reply(statusCode, statusCode === 200 ? { vars } : { error: 'Unauthorized' });
    return this;
  }

  mockVarDelete(name: string, statusCode = 200) {
    this.scope
      .delete(`/api/runtime/vars/${encodeURIComponent(name)}`)
      .reply(statusCode, statusCode === 200 ? {} : { error: 'Not found' });
    return this;
  }

  // Runtime secrets endpoints
  mockSecretSet(name: string, value: string, statusCode = 200) {
    this.scope
      .post('/api/runtime/secrets', (body: any) => {
        return body.name === name && body.value === value;
      })
      .reply(statusCode, statusCode === 200 ? {} : { error: 'Invalid request' });
    return this;
  }

  mockSecretUpdate(name: string, value: string, statusCode = 200) {
    this.scope
      .put(`/api/runtime/secrets/${encodeURIComponent(name)}`, (body: any) => {
        return body.value === value;
      })
      .reply(statusCode, statusCode === 200 ? {} : statusCode === 404 ? { error: 'Not found' } : { error: 'Invalid request' });
    return this;
  }

  mockSecretList(secrets: Array<{ name: string }>, statusCode = 200) {
    this.scope
      .get('/api/runtime/secrets')
      .reply(statusCode, statusCode === 200 ? { secrets } : { error: 'Unauthorized' });
    return this;
  }

  mockSecretDelete(name: string, statusCode = 200) {
    this.scope
      .delete(`/api/runtime/secrets/${encodeURIComponent(name)}`)
      .reply(statusCode, statusCode === 200 ? {} : { error: 'Not found' });
    return this;
  }

  // Models endpoint
  mockModels(response?: any, statusCode = 200) {
    const defaultResponse = {
      models: [
        {
          id: 'anthropic/claude-3-5-sonnet',
          name: 'Claude 3.5 Sonnet',
          description: 'Anthropic Claude 3.5 Sonnet',
          supported_parameters: ['tools', 'temperature'],
          pricing: { prompt: '0.000003', completion: '0.000015' }
        },
        {
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          description: 'OpenAI GPT-4o',
          supported_parameters: ['temperature'],
          pricing: { prompt: '0.000005', completion: '0.000015' }
        },
        {
          id: 'anthropic/claude-3-haiku',
          name: 'Claude 3 Haiku',
          description: 'Anthropic Claude 3 Haiku',
          supported_parameters: ['tools'],
          pricing: { prompt: '0.00000025', completion: '0.00000125' }
        },
        {
          id: 'openai/gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          description: 'OpenAI GPT-3.5 Turbo',
          supported_parameters: [],
          pricing: { prompt: '0.0000005', completion: '0.0000015' }
        }
      ]
    };
    this.scope
      .get('/api/models')
      .reply(statusCode, response || defaultResponse);
    return this;
  }

  // Organization info endpoint
  mockOrgInfo(response?: any, statusCode = 200) {
    const defaultResponse = {
      name: 'Test Organization',
      slug: 'test-org',
      status: 'active',
      credits: 10.50,
      created_at: '2024-01-01T00:00:00Z'
    };
    this.scope
      .get('/api/orginfo')
      .reply(statusCode, response || defaultResponse);
    return this;
  }

  cleanup() {
    nock.cleanAll();
  }
}

export function setupApiMock() {
  // Ensure nock is active
  if (!nock.isActive()) {
    nock.activate();
  }
  return new ApiMock();
}

export function cleanupApiMocks() {
  // Abort any pending requests first
  nock.abortPendingRequests();
  // Clean all interceptors (including persistent ones)
  nock.cleanAll();
  // Wait for any pending async operations to complete
  // This helps ensure MockHttpSocket connections are closed
  return new Promise<void>((resolve) => {
    setImmediate(() => {
      resolve();
    });
  });
}
