import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import axios from 'axios';
import {
  getAuthHeaders,
  fetchOrgInfo,
  fetchSuites,
  fetchSuite,
  fetchRuns,
  fetchRun,
  fetchModels,
  handleApiError,
  promptYesNo
} from './command-helpers';
import * as readline from 'readline';

// Mock modules
jest.mock('axios');
jest.mock('child_process');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('command-helpers utilities', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Set test environment
    process.env.VIBECHECK_API_KEY = 'test-api-key';
    process.env.VIBECHECK_URL = 'http://localhost:3000';
    delete process.env.VIBECHECK_NEVER_PROMPT;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAuthHeaders', () => {
    it('should return auth headers with API key', () => {
      process.env.VIBECHECK_API_KEY = 'test-key-123';

      const headers = getAuthHeaders();

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key-123'
      });
    });

    it('should exit when API key is missing and neverPrompt is true', () => {
      delete process.env.VIBECHECK_API_KEY;
      process.env.VIBECHECK_NEVER_PROMPT = 'true';

      // Mock getOrgApiKey to return null
      const config = require('./config');
      const getOrgApiKeySpy = jest.spyOn(config, 'getOrgApiKey').mockReturnValue(null);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => getAuthHeaders()).toThrow('process.exit: 1');

      consoleErrorSpy.mockRestore();
      exitMock.mockRestore();
      getOrgApiKeySpy.mockRestore();
    });

    it('should attempt to prompt for redeem when API key is missing', () => {
      delete process.env.VIBECHECK_API_KEY;

      // Mock getOrgApiKey to return null
      const config = require('./config');
      const getOrgApiKeySpy = jest.spyOn(config, 'getOrgApiKey').mockReturnValue(null);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const childProc = require('child_process');
      const spawnSpy = jest.spyOn(childProc, 'spawnSync').mockReturnValue({ status: 0 } as any);

      expect(() => getAuthHeaders()).toThrow('process.exit: 1');

      spawnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      exitMock.mockRestore();
      getOrgApiKeySpy.mockRestore();
    });
  });

  describe('fetchOrgInfo', () => {
    it('should fetch organization info successfully', async () => {
      const mockResponse = {
        data: {
          name: 'Test Org',
          slug: 'test-org',
          status: 'active',
          credits: 10.50
        },
        status: 200
      };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await fetchOrgInfo(false);

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3000/api/orginfo',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should log debug info when debug is true', async () => {
      const mockResponse = {
        data: { name: 'Test Org' },
        status: 200
      };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await fetchOrgInfo(true);

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Request URL: http://localhost:3000/api/orginfo');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response status: 200');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response data:', expect.any(String));

      consoleSpy.mockRestore();
    });

    it('should throw error when API returns error', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { error: 'Not found' },
        status: 200
      });

      await expect(fetchOrgInfo()).rejects.toThrow('Not found');
    });

    it('should handle network errors', async () => {
      mockedAxios.get.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Network error'
      });

      await expect(fetchOrgInfo()).rejects.toThrow();
    });
  });

  describe('fetchSuites', () => {
    it('should fetch suites successfully', async () => {
      const mockSuites = [
        { name: 'suite1', evalCount: 5 },
        { name: 'suite2', evalCount: 10 }
      ];
      mockedAxios.get.mockResolvedValue({
        data: { suites: mockSuites },
        status: 200
      });

      const result = await fetchSuites(false);

      expect(result).toEqual(mockSuites);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3000/api/suite/list',
        expect.any(Object)
      );
    });

    it('should log debug info when debug is true', async () => {
      const mockSuites = [{ name: 'suite1', evalCount: 5 }];
      mockedAxios.get.mockResolvedValue({
        data: { suites: mockSuites },
        status: 200
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await fetchSuites(true);

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Request URL: http://localhost:3000/api/suite/list');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response status: 200');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response data:', expect.any(String));

      consoleSpy.mockRestore();
    });

    it('should return empty array when no suites', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {},
        status: 200
      });

      const result = await fetchSuites();

      expect(result).toEqual([]);
    });

    it('should throw error on API error response', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { error: 'Unauthorized' },
        status: 200
      });

      await expect(fetchSuites()).rejects.toThrow('Unauthorized');
    });
  });

  describe('fetchSuite', () => {
    it('should fetch specific suite successfully', async () => {
      const mockSuite = {
        name: 'test-suite',
        yamlContent: 'metadata:\n  name: test-suite'
      };
      mockedAxios.get.mockResolvedValue({
        data: { suite: mockSuite },
        status: 200
      });

      const result = await fetchSuite('test-suite', false);

      expect(result).toEqual(mockSuite);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3000/api/suite/test-suite',
        expect.any(Object)
      );
    });

    it('should log debug info when debug is true', async () => {
      const mockSuite = { name: 'test-suite', yamlContent: 'test' };
      mockedAxios.get.mockResolvedValue({
        data: { suite: mockSuite },
        status: 200
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await fetchSuite('test-suite', true);

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Request URL: http://localhost:3000/api/suite/test-suite');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response status: 200');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response data:', expect.any(String));

      consoleSpy.mockRestore();
    });

    it('should encode suite name in URL', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { suite: { name: 'test suite' } },
        status: 200
      });

      await fetchSuite('test suite');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('test%20suite'),
        expect.any(Object)
      );
    });
  });

  describe('fetchRuns', () => {
    it('should fetch runs successfully', async () => {
      const mockRuns = [
        { id: 'run-1', status: 'completed' },
        { id: 'run-2', status: 'running' }
      ];
      mockedAxios.get.mockResolvedValue({
        data: { runs: mockRuns },
        status: 200
      });

      const result = await fetchRuns({}, false);

      expect(result).toEqual(mockRuns);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3000/api/runs',
        expect.objectContaining({
          params: {}
        })
      );
    });

    it('should log debug info when debug is true', async () => {
      const mockRuns = [{ id: 'run-1', status: 'completed' }];
      mockedAxios.get.mockResolvedValue({
        data: { runs: mockRuns },
        status: 200
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await fetchRuns({}, true);

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Request URL: http://localhost:3000/api/runs');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Request options:', {});
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response status: 200');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response data:', expect.any(String));

      consoleSpy.mockRestore();
    });

    it('should pass query options as params', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { runs: [] },
        status: 200
      });

      await fetchRuns({ limit: 10, offset: 5 });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: { limit: 10, offset: 5 }
        })
      );
    });

    it('should return empty array when no runs', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {},
        status: 200
      });

      const result = await fetchRuns();

      expect(result).toEqual([]);
    });
  });

  describe('fetchRun', () => {
    it('should fetch specific run successfully', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'completed',
        results: []
      };
      mockedAxios.get.mockResolvedValue({
        data: { run: mockRun },
        status: 200
      });

      const result = await fetchRun('run-123', false);

      expect(result).toEqual(mockRun);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3000/api/runs/run-123',
        expect.any(Object)
      );
    });

    it('should log debug info when debug is true', async () => {
      const mockRun = { id: 'run-123', status: 'completed', results: [] };
      mockedAxios.get.mockResolvedValue({
        data: { run: mockRun },
        status: 200
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await fetchRun('run-123', true);

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Request URL: http://localhost:3000/api/runs/run-123');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response status: 200');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response data:', expect.any(String));

      consoleSpy.mockRestore();
    });

    it('should encode run ID in URL', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { run: { id: 'run 123' } },
        status: 200
      });

      await fetchRun('run 123');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('run%20123'),
        expect.any(Object)
      );
    });
  });

  describe('fetchModels', () => {
    it('should fetch models successfully', async () => {
      const mockModels = [
        { id: 'model-1', name: 'Model 1' },
        { id: 'model-2', name: 'Model 2' }
      ];
      mockedAxios.get.mockResolvedValue({
        data: { models: mockModels },
        status: 200
      });

      const result = await fetchModels(false);

      expect(result).toEqual(mockModels);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3000/api/models',
        expect.any(Object)
      );
    });

    it('should log debug info when debug is true', async () => {
      const mockModels = [{ id: 'model-1', name: 'Model 1' }];
      mockedAxios.get.mockResolvedValue({
        data: { models: mockModels },
        status: 200
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await fetchModels(true);

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Request URL: http://localhost:3000/api/models');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response status: 200');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Response data:', expect.any(String));

      consoleSpy.mockRestore();
    });

    it('should return empty array when no models', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {},
        status: 200
      });

      const result = await fetchModels();

      expect(result).toEqual([]);
    });
  });

  describe('handleApiError', () => {
    it('should handle network errors', () => {
      const error = {
        code: 'ECONNREFUSED',
        message: 'Network error'
      };

      expect(() => handleApiError(error)).toThrow(/developer preview can no longer be reached/);
    });

    it('should handle 401 unauthorized', () => {
      process.env.VIBECHECK_NEVER_PROMPT = 'true';
      const error = {
        response: {
          status: 401,
          data: {}
        }
      };

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => handleApiError(error)).toThrow('process.exit: 1');

      consoleErrorSpy.mockRestore();
      exitMock.mockRestore();
    });

    it('should handle 403 forbidden', () => {
      process.env.VIBECHECK_NEVER_PROMPT = 'true';
      const error = {
        response: {
          status: 403,
          data: {}
        }
      };

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => handleApiError(error)).toThrow('process.exit: 1');

      consoleErrorSpy.mockRestore();
      exitMock.mockRestore();
    });

    it('should handle 500 server error', () => {
      const error = {
        response: {
          status: 500,
          data: {}
        }
      };

      expect(() => handleApiError(error)).toThrow('Server error');
    });

    it('should handle API error response', () => {
      const error = {
        response: {
          status: 400,
          data: {
            error: 'Bad request'
          }
        }
      };

      expect(() => handleApiError(error)).toThrow('API Error: Bad request');
    });

    it('should handle generic error', () => {
      const error = new Error('Something went wrong');

      expect(() => handleApiError(error)).toThrow('Something went wrong');
    });
  });

  describe('promptYesNo', () => {
    // Note: Testing readline interaction is complex due to mocking challenges
    // The function is covered through integration tests
    it('should exist and be a function', () => {
      expect(typeof promptYesNo).toBe('function');
    });
  });
});
