import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { suppressConsole, configureAxiosForTests, createTempFile, cleanupTempFiles } from '../helpers/test-utils';
import { saveCommand, listCommand, getCommand } from '../../packages/cli/src/commands/suite';

describe('vibe suite commands - Extended Coverage', () => {
  let apiMock: ReturnType<typeof setupApiMock>;
  let axiosCleanup: (() => void) | undefined;
  const testApiKey = 'test-api-key-12345';

  beforeEach(() => {
    apiMock = setupApiMock();
    axiosCleanup = configureAxiosForTests();
    process.env.VIBECHECK_API_KEY = testApiKey;
    process.env.VIBECHECK_URL = 'http://localhost:3000';
  });

  afterEach(async () => {
    await cleanupApiMocks();
    if (axiosCleanup) {
      await axiosCleanup();
      axiosCleanup = undefined;
    }
    cleanupTempFiles();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Save command error handling', () => {
    it('should handle API returning error in response', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'error-response.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/suite/save')
        .reply(200, { error: 'Suite name already exists' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await saveCommand({ file: tempFile, debug: false });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 500 server error when saving', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'server-error.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/suite/save')
        .reply(500, { error: 'Internal server error' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await saveCommand({ file: tempFile, debug: false });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 401 unauthorized when saving', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'unauthorized.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/suite/save')
        .reply(401, { error: 'Unauthorized' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await saveCommand({ file: tempFile, debug: false });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 403 forbidden when saving', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'forbidden.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/suite/save')
        .reply(403, { error: 'Forbidden' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await saveCommand({ file: tempFile, debug: false });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle API error in response data', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'api-error.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/suite/save')
        .reply(400, { error: 'Invalid suite configuration' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await saveCommand({ file: tempFile, debug: false });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it.skip('should handle generic error when saving', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'generic-error.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/suite/save')
        .replyWithError('Network connection lost');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await saveCommand({ file: tempFile, debug: false });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle network error when saving', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'network-error.yaml');

      await cleanupApiMocks();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await saveCommand({ file: tempFile, debug: false });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });
  });

  describe('List command edge cases', () => {
    it('should handle empty suite list', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .get('/api/suite/list')
        .reply(200, { suites: [] });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await listCommand(false);

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      expect(logs.some(log => log.includes('No suites found'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle API error in list response', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .get('/api/suite/list')
        .reply(200, { error: 'Failed to fetch suites' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await listCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should log debug info when listing suites', async () => {
      apiMock.mockListSuites();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await listCommand(true);

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasDebugLog = logs.some(log => log.includes('[DEBUG]'));
      expect(hasDebugLog).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle network error when listing', async () => {
      await cleanupApiMocks();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await listCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 500 error when listing', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .get('/api/suite/list')
        .reply(500, { error: 'Server error' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await listCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });
  });

  describe('Get command edge cases', () => {
    it('should handle API error in get response', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .get('/api/suite/test-suite')
        .reply(200, { error: 'Suite not accessible' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await getCommand('test-suite', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should log debug info when getting suite', async () => {
      apiMock.mockGetSuite('debug-suite');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await getCommand('debug-suite', true);

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasDebugLog = logs.some(log => log.includes('[DEBUG]'));
      expect(hasDebugLog).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle network error when getting suite', async () => {
      await cleanupApiMocks();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await getCommand('test-suite', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 500 error when getting suite', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .get('/api/suite/test-suite')
        .reply(500, { error: 'Server error' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await getCommand('test-suite', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle API error data when getting suite', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .get('/api/suite/test-suite')
        .reply(400, { error: 'Invalid suite name' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await getCommand('test-suite', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle generic error when getting suite', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .get('/api/suite/test-suite')
        .replyWithError('Connection timeout');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await getCommand('test-suite', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });
  });
});
