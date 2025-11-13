import { VibeCheckRunner } from './runner';
import { RunOptions, EvalResult, RunnerConfig } from './types';

// Export main classes
export { VibeCheckRunner } from './runner';

// Export types
export * from './types';

// Export errors
export * from './errors';

// Convenience function for running vibe checks
export async function runVibeCheck(options: RunOptions & { apiKey?: string; apiUrl?: string }): Promise<EvalResult[]> {
  const { apiKey, apiUrl, ...runOptions } = options;

  const config: RunnerConfig = {};
  if (apiKey) config.apiKey = apiKey;
  if (apiUrl) config.apiUrl = apiUrl;

  const runner = new VibeCheckRunner(config);
  return runner.run(runOptions);
}
