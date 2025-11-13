import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { suppressConsole, configureAxiosForTests } from '../helpers/test-utils';
import { modelsCommand } from '../../packages/cli/src/commands/models';

describe('vibe get models command', () => {
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
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should fetch and display models successfully', async () => {
      apiMock.mockModels();

      await suppressConsole(async () => {
        await modelsCommand(false);
      });
    });

    it('should display models with price tiers', async () => {
      apiMock.mockModels();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await modelsCommand(false);

      // Verify table headers were printed
      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasHeader = logs.some(log => log.includes('ID') && log.includes('MCP') && log.includes('Price'));
      expect(hasHeader).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle empty models list', async () => {
      apiMock.mockModels({ models: [] });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await modelsCommand(false);

      // Verify "No models available" message
      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasMessage = logs.some(log => log.includes('No models available'));
      expect(hasMessage).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Filtering', () => {
    it('should filter by MCP support', async () => {
      apiMock.mockModels();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await modelsCommand(false, true); // mcpFilter = true

      // Verify MCP filter is mentioned
      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasFilter = logs.some(log => log.includes('MCP only'));
      expect(hasFilter).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should filter by price quartiles', async () => {
      apiMock.mockModels();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await modelsCommand(false, false, '1,2'); // price filter

      // Verify price filter is mentioned
      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasFilter = logs.some(log => log.includes('Price:'));
      expect(hasFilter).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should filter by provider', async () => {
      apiMock.mockModels();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await modelsCommand(false, false, undefined, 'anthropic'); // provider filter

      // Verify provider filter is mentioned
      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasFilter = logs.some(log => log.includes('Provider:'));
      expect(hasFilter).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should combine multiple filters', async () => {
      apiMock.mockModels();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await modelsCommand(false, true, '1,2', 'anthropic,openai');

      // Verify all filters are shown
      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const output = logs.join('\n');
      expect(output).toMatch(/MCP only/);
      expect(output).toMatch(/Price:/);
      expect(output).toMatch(/Provider:/);

      consoleSpy.mockRestore();
    });

    it('should show message when filters result in no models', async () => {
      // Mock with only non-MCP models
      apiMock.mockModels({
        models: [
          {
            id: 'test/model',
            description: 'Test model',
            supported_parameters: [],
            pricing: { prompt: '0.000001', completion: '0.000001' }
          }
        ]
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await modelsCommand(false, true); // MCP filter will exclude all

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasMessage = logs.some(log => log.includes('No models match the specified filters'));
      expect(hasMessage).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle 401 unauthorized error', async () => {
      apiMock.mockModels({ error: 'Unauthorized' }, 401);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await modelsCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 403 forbidden error', async () => {
      apiMock.mockModels({ error: 'Forbidden' }, 403);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await modelsCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 500 server error', async () => {
      apiMock.mockModels({ error: 'Internal server error' }, 500);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await modelsCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle API error response', async () => {
      apiMock.mockModels({ error: 'Custom API error' }, 200);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await modelsCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle missing API key', async () => {
      delete process.env.VIBECHECK_API_KEY;

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await modelsCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });
  });

  describe('Debug mode', () => {
    it('should log debug information when debug is true', async () => {
      apiMock.mockModels();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await modelsCommand(true); // debug = true

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasDebugLog = logs.some(log => log.includes('[DEBUG]'));
      expect(hasDebugLog).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
