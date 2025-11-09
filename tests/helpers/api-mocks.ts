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

  mockListRuns(statusCode = 200) {
    this.scope
      .get('/api/runs')
      .query(true) // Accept any query parameters
      .reply(statusCode, statusCode === 200 ? mockListRunsResponse : mockUnauthorizedResponse);
    return this;
  }

  mockGetRun(runId: string, statusCode = 200) {
    this.scope
      .get(`/api/runs/${runId}`)
      .reply(statusCode, statusCode === 200 ? mockGetRunResponse : { error: 'Run not found' });
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
