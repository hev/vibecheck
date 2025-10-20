import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as config from '../utils/config';
import axios from 'axios';

jest.mock('readline', () => {
  return {
    createInterface: jest.fn()
  };
});

jest.mock('fs', () => {
  const actual: any = jest.requireActual('fs');
  return Object.assign({}, actual, { existsSync: jest.fn() });
});

const mockAxiosPost = jest.fn() as jest.MockedFunction<any>;
jest.mock('axios', () => ({
  post: mockAxiosPost
}));

// We will import functions under test lazily in each test to get fresh mocks

describe('redeem interactive flow', () => {
  const envPath = config.getConfigPath();

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    // Reset axios mock
    mockAxiosPost.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels when user presses Enter with no code', async () => {
    jest.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error('exit:'+code); }) as any);
    const rl = await import('readline');
    (rl.createInterface as any).mockReturnValue({
      question: (q: string, cb: (a: string) => void) => cb(''),
      close: () => {}
    } as any);

    const { redeemFlow } = await import('./redeem');

    await expect(redeemFlow({})).rejects.toThrow('exit:0');
  });

  it('prompts overwrite if env exists and respects No', async () => {
    // Set up mocks before importing the module
    (fs.existsSync as unknown as jest.Mock).mockReturnValue(true);
    jest.spyOn(config, 'readEnvFile').mockReturnValue('VIBECHECK_API_KEY=old');
    jest.spyOn(config, 'saveApiKey').mockImplementation(() => {});

    const rl = await import('readline');
    // First question: invite code; Second: overwrite? -> empty => no
    const answers = ['CODE123', ''];
    (rl.createInterface as any).mockReturnValue({
      question: (q: string, cb: (a: string) => void) => {
        const answer = answers.shift() || '';
        cb(answer);
      },
      close: () => {}
    } as any);

    // Mock axios redeem response
    mockAxiosPost.mockResolvedValue({ 
      data: { apiKey: 'NEWKEY', org: { id: '1', slug: 's', name: 'Org', credits: 10 } }, 
      status: 200 
    } as any);

    // Mock process.exit to throw for any exit call
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`exit:${code}`);
    });

    // Use jest.doMock to ensure mocks are applied before module import
    jest.doMock('fs', () => ({
      ...(jest.requireActual('fs') as any),
      existsSync: jest.fn().mockReturnValue(true)
    }));

    jest.doMock('../utils/config', () => ({
      ...(jest.requireActual('../utils/config') as any),
      readEnvFile: jest.fn().mockReturnValue('VIBECHECK_API_KEY=old'),
      saveApiKey: jest.fn()
    }));

    // Import after all mocks are set up
    const { redeemFlow } = await import('./redeem');
    
    // The function should exit with code 0 when user chooses not to overwrite
    await expect(redeemFlow({})).rejects.toThrow('exit:0');
    expect(config.saveApiKey).not.toHaveBeenCalled();
    
    exitSpy.mockRestore();
  });
});


