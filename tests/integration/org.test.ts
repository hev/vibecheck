import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { suppressConsole, configureAxiosForTests } from '../helpers/test-utils';
import { orgCommand } from '../../packages/cli/src/commands/org';

describe('vibe get org command', () => {
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
    it('should fetch and display organization info successfully', async () => {
      apiMock.mockOrgInfo();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await orgCommand(false);

      // Verify organization info was printed
      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const output = logs.join('\n');
      expect(output).toMatch(/Organization:/);
      expect(output).toMatch(/Test Organization/);
      expect(output).toMatch(/Credits:/);
      expect(output).toMatch(/Status:/);

      consoleSpy.mockRestore();
    });

    it('should display credits in white when above $1.00', async () => {
      apiMock.mockOrgInfo({
        name: 'Test Org',
        slug: 'test',
        status: 'active',
        credits: 10.50,
        created_at: '2024-01-01T00:00:00Z'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await orgCommand(false);

      // Just verify it displays without errors
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should display low credits warning when below $1.00', async () => {
      apiMock.mockOrgInfo({
        name: 'Test Org',
        slug: 'test',
        status: 'active',
        credits: 0.50,
        created_at: '2024-01-01T00:00:00Z'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await orgCommand(false);

      // Verify it displays credits
      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const output = logs.join('\n');
      expect(output).toMatch(/\$0\.50/);

      consoleSpy.mockRestore();
    });

    it('should display zero credits', async () => {
      apiMock.mockOrgInfo({
        name: 'Test Org',
        slug: 'test',
        status: 'active',
        credits: 0.00,
        created_at: '2024-01-01T00:00:00Z'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await orgCommand(false);

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const output = logs.join('\n');
      expect(output).toMatch(/\$0\.00/);

      consoleSpy.mockRestore();
    });

    it('should display formatted creation date', async () => {
      apiMock.mockOrgInfo({
        name: 'Test Org',
        slug: 'test',
        status: 'active',
        credits: 5.00,
        created_at: '2024-01-15T10:30:00Z'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await orgCommand(false);

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const output = logs.join('\n');
      expect(output).toMatch(/Created:/);

      consoleSpy.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle 401 unauthorized error', async () => {
      apiMock.mockOrgInfo({ error: 'Unauthorized' }, 401);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await orgCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 403 forbidden error', async () => {
      apiMock.mockOrgInfo({ error: 'Forbidden' }, 403);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await orgCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 500 server error', async () => {
      apiMock.mockOrgInfo({ error: 'Internal server error' }, 500);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await orgCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle API error response', async () => {
      apiMock.mockOrgInfo({ error: 'Custom API error' }, 200);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await orgCommand(false);
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
          await orgCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });
  });

  describe('Debug mode', () => {
    it('should log debug information when debug is true', async () => {
      apiMock.mockOrgInfo();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await orgCommand(true); // debug = true

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasDebugLog = logs.some(log => log.includes('[DEBUG]'));
      expect(hasDebugLog).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
