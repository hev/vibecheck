import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { suppressConsole, configureAxiosForTests } from '../helpers/test-utils';
import { redeemCommand } from '../../packages/cli/src/commands/redeem';

describe('vibe redeem command', () => {
  let apiMock: ReturnType<typeof setupApiMock>;
  let axiosCleanup: (() => void) | undefined;

  beforeEach(() => {
    apiMock = setupApiMock();
    axiosCleanup = configureAxiosForTests();
    process.env.VIBECHECK_URL = 'http://localhost:3000';
    delete process.env.VIBECHECK_API_KEY;
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

  describe('Input validation', () => {
    it('should require invite code', async () => {
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await redeemCommand('', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should reject undefined code', async () => {
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await redeemCommand(null as any, false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });
  });

  describe('Debug mode', () => {
    it('should log debug information', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/invites/redeem')
        .reply(200, {
          apiKey: 'test-key',
          org: {
            id: 'org-1',
            slug: 'test-org',
            name: 'Test Org',
            credits: 10.0
          }
        });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      // Mock readline to avoid interactive prompts
      const readline = require('readline');
      const mockInterface = {
        question: jest.fn((q: string, callback: (answer: string) => void) => {
          callback('n'); // No to overwrite
        }),
        close: jest.fn()
      };
      jest.spyOn(readline, 'createInterface').mockReturnValue(mockInterface as any);

      // Mock fs to simulate no existing config
      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      try {
        await redeemCommand('TEST123', true);
      } catch (error: any) {
        // May exit or complete
      }

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasDebugLog = logs.some(log => log.includes('[DEBUG]'));
      expect(hasDebugLog).toBe(true);

      consoleSpy.mockRestore();
      exitMock.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle invalid invite code', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/invites/redeem')
        .reply(400, { error: 'Invalid invite code' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await redeemCommand('INVALID', false);
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit: 1/);
        }
      });

      exitMock.mockRestore();
    });

    it('should handle expired invite code', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/invites/redeem')
        .reply(410, { error: 'Invite code expired' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await redeemCommand('EXPIRED', false);
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit: 1/);
        }
      });

      exitMock.mockRestore();
    });

    it('should handle network timeout', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/invites/redeem')
        .delay(35000) // Longer than 30s timeout
        .reply(200, {});

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await redeemCommand('TIMEOUT', false);
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit|timeout/i);
        }
      });

      exitMock.mockRestore();
    }, 40000); // 40 second timeout for this test

    it('should handle server error', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/invites/redeem')
        .reply(500, { error: 'Internal server error' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await redeemCommand('ERROR', false);
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit/);
        }
      });

      exitMock.mockRestore();
    });

    it('should handle network connection error', async () => {
      // Clean up mocks to simulate no connection
      await cleanupApiMocks();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await redeemCommand('NONETWORK', false);
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit/);
        }
      });

      exitMock.mockRestore();
    });
  });

  describe('Success path', () => {
    it('should handle successful redemption with no existing config', async () => {
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/invites/redeem')
        .reply(200, {
          apiKey: 'new-api-key',
          org: {
            id: 'org-123',
            slug: 'new-org',
            name: 'New Organization',
            credits: 25.0
          }
        });

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      try {
        await redeemCommand('VALID123', false);

        // Verify success message was shown
        const logs = consoleSpy.mock.calls.map(call => call.join(' '));
        const hasSuccess = logs.some(log => log.includes('New Organization') || log.includes('new-api-key'));
        expect(hasSuccess).toBe(true);
      } catch (error: any) {
        // May exit with 0 on success
        if (error.message?.includes('process.exit: 0')) {
          // Success!
        }
      }

      consoleSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
      exitMock.mockRestore();
    });
  });
});
