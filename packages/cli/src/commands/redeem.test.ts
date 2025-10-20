import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as config from '../utils/config';

// We will import functions under test lazily in each test to get fresh mocks

describe('redeem interactive flow', () => {
  const envPath = config.getConfigPath();

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels when user presses Enter with no code', async () => {
    jest.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error('exit:'+code); }) as any);
    const rl = await import('readline');
    jest.spyOn(rl, 'createInterface').mockReturnValue({
      question: (q: string, cb: (a: string) => void) => cb(''),
      close: () => {}
    } as any);

    const { redeemFlow } = await import('./redeem');

    await expect(redeemFlow({})).rejects.toThrow('exit:0');
  });

  it('prompts overwrite if env exists and respects No', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(config, 'readEnvFile').mockReturnValue('VIBECHECK_API_KEY=old');
    jest.spyOn(config, 'saveApiKey').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error('exit:'+code); }) as any);

    const rl = await import('readline');
    // First question: invite code; Second: overwrite? -> empty => no
    const answers = ['CODE123', ''];
    jest.spyOn(rl, 'createInterface').mockReturnValue({
      question: (q: string, cb: (a: string) => void) => cb(answers.shift() || ''),
      close: () => {}
    } as any);

    // Mock axios redeem response
    const axios = await import('axios');
    jest.spyOn(axios, 'post' as any).mockResolvedValue({ data: { apiKey: 'NEWKEY', org: { id: '1', slug: 's', name: 'Org', credits: 10 } }, status: 200 } as any);

    const { redeemFlow } = await import('./redeem');
    await expect(redeemFlow({})).rejects.toThrow('exit:0');
    expect(config.saveApiKey).not.toHaveBeenCalled();
  });
});


