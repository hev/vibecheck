import axios from 'axios';
import nock from 'nock';
import { stopRunCommand, stopAllQueuedRunsCommand } from '../../packages/cli/src/commands/stop';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';

describe('Stop Run Command', () => {
  const testApiKey = 'test-api-key-12345';

  beforeEach(() => {
    setupApiMock();
    // Set up environment with test API key
    process.env.VIBECHECK_API_KEY = testApiKey;
    process.env.VIBECHECK_URL = 'http://localhost:3000';
    // Clear neverPrompt environment variable for test isolation
    delete process.env.VIBECHECK_NEVER_PROMPT;
  });

  afterEach(() => {
    cleanupApiMocks();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('should successfully cancel a queued run', async () => {
    const runId = 'test-run-123';
    const mockResponse = { success: true, cancelled: true };

    nock('http://localhost:3000')
      .post(`/api/runs/${runId}/cancel`)
      .reply(200, mockResponse);

    // Mock console methods to capture output
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const processSpy = jest.spyOn(process, 'exit').mockImplementation();

    await stopRunCommand(runId, false);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✨ Run "test-run-123" cancelled successfully!'));
    expect(processSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    processSpy.mockRestore();
  });

  it('should handle 404 run not found error', async () => {
    const runId = 'nonexistent-run';
    const mockError = { error: { code: 404, message: 'Run not found' } };

    nock('http://localhost:3000')
      .post(`/api/runs/${runId}/cancel`)
      .reply(404, mockError);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const processSpy = jest.spyOn(process, 'exit').mockImplementation();

    await stopRunCommand(runId, false);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Run "nonexistent-run" not found'));
    expect(processSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    processSpy.mockRestore();
  });

  it('should handle 409 run not queued error', async () => {
    const runId = 'completed-run';
    const mockError = { error: { code: 409, message: 'Only queued runs can be cancelled' } };

    nock('http://localhost:3000')
      .post(`/api/runs/${runId}/cancel`)
      .reply(409, mockError);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const processSpy = jest.spyOn(process, 'exit').mockImplementation();

    await stopRunCommand(runId, false);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Run "completed-run" cannot be cancelled'));
    expect(processSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    processSpy.mockRestore();
  });

  it('should handle 403 admin key error', async () => {
    const runId = 'test-run';
    const mockError = { error: { code: 403, message: 'Admin keys cannot access runs. Use an org API key.' } };

    nock('http://localhost:3000')
      .post(`/api/runs/${runId}/cancel`)
      .reply(403, mockError);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const processSpy = jest.spyOn(process, 'exit').mockImplementation();

    await stopRunCommand(runId, false);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Access denied'));
    expect(processSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    processSpy.mockRestore();
  });

  it('should handle 401 authentication error', async () => {
    const runId = 'test-run';
    const mockError = { error: { code: 401, message: 'Invalid or missing API key' } };

    nock('http://localhost:3000')
      .post(`/api/runs/${runId}/cancel`)
      .reply(401, mockError);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const processSpy = jest.spyOn(process, 'exit').mockImplementation();

    await stopRunCommand(runId, false);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Authentication failed'));
    expect(processSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    processSpy.mockRestore();
  });

  it('should handle 500 server error', async () => {
    const runId = 'test-run';
    const mockError = { error: { code: 500, message: 'Internal server error' } };

    nock('http://localhost:3000')
      .post(`/api/runs/${runId}/cancel`)
      .reply(500, mockError);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const processSpy = jest.spyOn(process, 'exit').mockImplementation();

    await stopRunCommand(runId, false);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('API Error: Internal server error'));
    expect(processSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    processSpy.mockRestore();
  });

  it('should handle network errors', async () => {
    const runId = 'test-run';

    // Mock axios to throw a network error
    const axiosMock = jest.spyOn(require('axios'), 'post').mockRejectedValue({
      request: {},
      message: 'Network Error'
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const processSpy = jest.spyOn(process, 'exit').mockImplementation();

    await stopRunCommand(runId, false);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'));
    expect(processSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    processSpy.mockRestore();
    axiosMock.mockRestore();
  });

  it('should show debug output when debug flag is enabled', async () => {
    const runId = 'test-run-123';
    const mockResponse = { success: true, cancelled: true };

    nock('http://localhost:3000')
      .post(`/api/runs/${runId}/cancel`)
      .reply(200, mockResponse);

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const processSpy = jest.spyOn(process, 'exit').mockImplementation();

    await stopRunCommand(runId, true);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Request URL:'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Response status: 200'));
    // The debug data is logged as a separate call, so we need to check for any call containing the debug data
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Response data:'), expect.any(String));

    consoleSpy.mockRestore();
    processSpy.mockRestore();
  });

  describe('Stop All Queued Runs Command', () => {
    it('should successfully cancel all queued runs', async () => {
      const mockQueuedRuns = [
        { id: 'run-1', suite_name: 'test-suite-1' },
        { id: 'run-2', suite_name: 'test-suite-2' }
      ];
      const mockRunsResponse = { runs: mockQueuedRuns };
      const mockCancelResponse = { success: true, cancelled: true };

      // Mock the runs list request
      nock('http://localhost:3000')
        .get('/api/runs')
        .query({ status: 'queued', limit: 100 })
        .reply(200, mockRunsResponse);

      // Mock the individual cancel requests
      nock('http://localhost:3000')
        .post('/api/runs/run-1/cancel')
        .reply(200, mockCancelResponse);

      nock('http://localhost:3000')
        .post('/api/runs/run-2/cancel')
        .reply(200, mockCancelResponse);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const processSpy = jest.spyOn(process, 'exit').mockImplementation();

      await stopAllQueuedRunsCommand(false);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Found 2 queued run(s) to cancel:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✨ Successfully cancelled 2 run(s)!'));
      expect(processSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });

    it('should handle no queued runs found', async () => {
      const mockRunsResponse = { runs: [] };

      nock('http://localhost:3000')
        .get('/api/runs')
        .query({ status: 'queued', limit: 100 })
        .reply(200, mockRunsResponse);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const processSpy = jest.spyOn(process, 'exit').mockImplementation();

      await stopAllQueuedRunsCommand(false);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No queued runs found to cancel.'));
      expect(processSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });

    it('should handle partial failures when cancelling runs', async () => {
      const mockQueuedRuns = [
        { id: 'run-1', suite_name: 'test-suite-1' },
        { id: 'run-2', suite_name: 'test-suite-2' }
      ];
      const mockRunsResponse = { runs: mockQueuedRuns };
      const mockCancelResponse = { success: true, cancelled: true };
      const mockErrorResponse = { error: { code: 409, message: 'Run not queued' } };

      // Mock the runs list request
      nock('http://localhost:3000')
        .get('/api/runs')
        .query({ status: 'queued', limit: 100 })
        .reply(200, mockRunsResponse);

      // Mock one successful cancel and one failure
      nock('http://localhost:3000')
        .post('/api/runs/run-1/cancel')
        .reply(200, mockCancelResponse);

      nock('http://localhost:3000')
        .post('/api/runs/run-2/cancel')
        .reply(409, mockErrorResponse);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const processSpy = jest.spyOn(process, 'exit').mockImplementation();

      await stopAllQueuedRunsCommand(false);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✨ Successfully cancelled 1 run(s)!'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🚩 Failed to cancel 1 run(s).'));
      expect(processSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });

    it('should handle error when getting queued runs', async () => {
      const mockErrorResponse = { error: { code: 401, message: 'Invalid API key' } };

      nock('http://localhost:3000')
        .get('/api/runs')
        .query({ status: 'queued', limit: 100 })
        .reply(401, mockErrorResponse);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const processSpy = jest.spyOn(process, 'exit').mockImplementation();

      await stopAllQueuedRunsCommand(false);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Authentication failed'));
      expect(processSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });

    it('should show debug output when debug flag is enabled', async () => {
      const mockQueuedRuns = [{ id: 'run-1', suite_name: 'test-suite-1' }];
      const mockRunsResponse = { runs: mockQueuedRuns };
      const mockCancelResponse = { success: true, cancelled: true };

      nock('http://localhost:3000')
        .get('/api/runs')
        .query({ status: 'queued', limit: 100 })
        .reply(200, mockRunsResponse);

      nock('http://localhost:3000')
        .post('/api/runs/run-1/cancel')
        .reply(200, mockCancelResponse);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const processSpy = jest.spyOn(process, 'exit').mockImplementation();

      await stopAllQueuedRunsCommand(true);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Runs request URL:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Runs response status: 200'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Cancel request URL:'));

      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });
  });
});
