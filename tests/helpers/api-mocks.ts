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

const API_URL = process.env.VIBECHECK_URL || 'http://localhost:3000';

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
      .get(`/api/eval/status/${runId}`)
      .reply(200, mockStatusPendingResponse);
    return this;
  }

  mockStatusCompleted(runId: string = 'test-run-id-123') {
    this.scope
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

  cleanup() {
    nock.cleanAll();
  }
}

export function setupApiMock() {
  return new ApiMock();
}

export function cleanupApiMocks() {
  nock.cleanAll();
}
