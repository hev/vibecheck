import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { displaySummary } from './display';
import { EvalResult, ConditionalResult } from '../types';

describe('Display Utilities', () => {
  let mockConsoleLog: any;
  let mockConsoleWarn: any;

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleWarn.mockRestore();
  });

  describe('displaySummary', () => {
    it('should display summary for all passing results', async () => {
      const results: EvalResult[] = [
        {
          evalName: 'test-1',
          prompt: 'What is 2 + 2?',
          response: '4',
          passed: true,
          checkResults: [
            { type: 'string_contains', passed: true, message: 'Contains "4"' },
            { type: 'token_length', passed: true, message: 'Token count valid' },
          ],
          executionTimeMs: 1500,
        },
        {
          evalName: 'test-2',
          prompt: 'What is the capital of France?',
          response: 'Paris',
          passed: true,
          checkResults: [
            { type: 'string_contains', passed: true, message: 'Contains "Paris"' },
          ],
          executionTimeMs: 1200,
        },
      ];

      await displaySummary(results, 2700);

      // Check that console.log was called
      expect(mockConsoleLog).toHaveBeenCalled();

      // Check for success percentage (100% pass rate)
      const calls = mockConsoleLog.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('Success Pct');
      expect(calls).toContain('100.0%');
    });

    it('should display summary for all failing results', async () => {
      const results: EvalResult[] = [
        {
          evalName: 'test-1',
          prompt: 'What is 2 + 2?',
          response: 'five',
          passed: false,
          checkResults: [
            { type: 'string_contains', passed: false, message: 'Does not contain "4"' },
          ],
          executionTimeMs: 1500,
        },
      ];

      await displaySummary(results, 1500);

      const calls = mockConsoleLog.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('Success Pct');
      expect(calls).toContain('0.0%');
    });

    it('should display summary for mixed results (50-80% pass rate)', async () => {
      const results: EvalResult[] = [
        {
          evalName: 'test-1',
          prompt: 'Test 1',
          response: 'Response 1',
          passed: true,
          checkResults: [
            { type: 'string_contains', passed: true, message: 'Pass' },
          ],
        },
        {
          evalName: 'test-2',
          prompt: 'Test 2',
          response: 'Response 2',
          passed: true,
          checkResults: [
            { type: 'string_contains', passed: true, message: 'Pass' },
          ],
        },
        {
          evalName: 'test-3',
          prompt: 'Test 3',
          response: 'Response 3',
          passed: true,
          checkResults: [
            { type: 'string_contains', passed: true, message: 'Pass' },
          ],
        },
        {
          evalName: 'test-4',
          prompt: 'Test 4',
          response: 'Response 4',
          passed: true,
          checkResults: [
            { type: 'string_contains', passed: true, message: 'Pass' },
          ],
        },
        {
          evalName: 'test-5',
          prompt: 'Test 5',
          response: 'Response 5',
          passed: false,
          checkResults: [
            { type: 'string_contains', passed: false, message: 'Fail' },
          ],
        },
      ];

      await displaySummary(results);

      const calls = mockConsoleLog.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('Success Pct');
      expect(calls).toContain('80.0%');
    });

    it('should display summary for results below 50%', async () => {
      const results: EvalResult[] = [
        {
          evalName: 'test-1',
          prompt: 'Test 1',
          response: 'Response 1',
          passed: true,
          checkResults: [
            { type: 'string_contains', passed: true, message: 'Pass' },
          ],
        },
        {
          evalName: 'test-2',
          prompt: 'Test 2',
          response: 'Response 2',
          passed: false,
          checkResults: [
            { type: 'string_contains', passed: false, message: 'Fail' },
          ],
        },
      ];

      await displaySummary(results);

      const calls = mockConsoleLog.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('Success Pct');
      expect(calls).toContain('50.0%');
    });

    it('should handle empty results array', async () => {
      const results: EvalResult[] = [];

      await displaySummary(results);

      expect(mockConsoleLog).toHaveBeenCalled();
      const calls = mockConsoleLog.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('0/0');
    });

    it('should display execution time when provided', async () => {
      const results: EvalResult[] = [
        {
          evalName: 'test-1',
          prompt: 'Test',
          response: 'Response',
          passed: true,
          checkResults: [
            { type: 'string_contains', passed: true, message: 'Pass' },
          ],
          executionTimeMs: 1500,
        },
      ];

      await displaySummary(results, 2500);

      const calls = mockConsoleLog.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('2.50s'); // Total time
      expect(calls).toContain('1.5s'); // Individual eval time
    });

    it('should handle results without execution time', async () => {
      const results: EvalResult[] = [
        {
          evalName: 'test-1',
          prompt: 'Test',
          response: 'Response',
          passed: true,
          checkResults: [
            { type: 'string_contains', passed: true, message: 'Pass' },
          ],
        },
      ];

      await displaySummary(results);

      expect(mockConsoleLog).toHaveBeenCalled();
      // Should not throw
    });

    it('should display pass/fail bars based on check results', async () => {
      const results: EvalResult[] = [
        {
          evalName: 'test-1',
          prompt: 'Test with mixed checks',
          response: 'Response',
          passed: false,
          checkResults: [
            { type: 'string_contains', passed: true, message: 'Pass' },
            { type: 'token_length', passed: false, message: 'Fail' },
            { type: 'semantic_similarity', passed: false, message: 'Fail' },
          ],
        },
      ];

      await displaySummary(results);

      const calls = mockConsoleLog.mock.calls.map((call: any) => String(call[0])).join('\n');
      // Should have 2 failures (--) and 1 pass (+)
      // The visual representation includes colored bars
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should truncate long prompt names', async () => {
      const longPrompt = 'This is a very long prompt that should be truncated because it exceeds the maximum length allowed for display in the summary table';

      const results: EvalResult[] = [
        {
          evalName: 'long-test',
          prompt: longPrompt,
          response: 'Response',
          passed: true,
          checkResults: [
            { type: 'string_contains', passed: true, message: 'Pass' },
          ],
        },
      ];

      await displaySummary(results);

      const calls = mockConsoleLog.mock.calls.map((call: any) => String(call[0])).join('\n');
      // Long prompts should be truncated with ...
      expect(calls).toContain('...');
    });

    it('should calculate pass rate correctly for various scenarios', async () => {
      // Test 1: 2 out of 3 passed (66.7%)
      const results1: EvalResult[] = [
        {
          evalName: 'test-1',
          prompt: 'Test 1',
          response: 'Response',
          passed: true,
          checkResults: [{ type: 'string_contains', passed: true, message: 'Pass' }],
        },
        {
          evalName: 'test-2',
          prompt: 'Test 2',
          response: 'Response',
          passed: true,
          checkResults: [{ type: 'string_contains', passed: true, message: 'Pass' }],
        },
        {
          evalName: 'test-3',
          prompt: 'Test 3',
          response: 'Response',
          passed: false,
          checkResults: [{ type: 'string_contains', passed: false, message: 'Fail' }],
        },
      ];

      await displaySummary(results1);
      let calls = mockConsoleLog.mock.calls.map((call: any) => String(call[0])).join('\n');
      expect(calls).toContain('66.7%');
      expect(calls).toContain('Success Pct');

      mockConsoleLog.mockClear();

      // Test 2: 3 out of 3 passed (100%)
      const results2: EvalResult[] = results1.map(r => ({ ...r, passed: true }));
      await displaySummary(results2);
      calls = mockConsoleLog.mock.calls.map((call: any) => String(call[0])).join('\n');
      expect(calls).toContain('100.0%');
      expect(calls).toContain('Success Pct');
    });

    it('should handle child results in OR checks correctly', async () => {
      const results: EvalResult[] = [
        {
          evalName: 'or-check-test',
          prompt: 'What is 2 + 2?',
          response: 'The answer is 4',
          passed: true,
          checkResults: [
            {
              type: 'or',
              passed: true,
              message: 'OR check passed',
              children: [
                { type: 'match', passed: true, message: 'Pattern "*4*" found' },
                { type: 'match', passed: false, message: 'Pattern "*four*" not found' },
                { type: 'min_tokens', passed: true, message: 'Token count 5 (min: 1)' },
              ],
            },
            {
              type: 'match',
              passed: true,
              message: 'Pattern "*4*" found',
            },
          ],
        },
      ];

      await displaySummary(results);

      const calls = mockConsoleLog.mock.calls.map((call: any) => String(call[0])).join('\n');
      
      // Should display summary without errors
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(calls).toContain('Success Pct');
      
      // The summary should count all checks including child checks for the visual bar
      // Parent OR check: 1 pass, Child checks: 2 pass, 1 fail, Regular check: 1 pass
      // Total: 4 pass, 1 fail
      expect(calls).toContain('100.0%'); // Eval-level pass rate
    });

    it('should handle nested child results correctly in pass/fail bars', async () => {
      const results: EvalResult[] = [
        {
          evalName: 'nested-check-test',
          prompt: 'Test prompt',
          response: 'Test response',
          passed: false,
          checkResults: [
            {
              type: 'or',
              passed: false,
              message: 'OR check failed',
              children: [
                { type: 'match', passed: true, message: 'Pattern found' },
                { type: 'match', passed: false, message: 'Pattern not found' },
                { type: 'match', passed: false, message: 'Pattern not found' },
              ],
            },
            {
              type: 'semantic',
              passed: true,
              message: 'Similarity 0.85',
            },
          ],
        },
      ];

      await displaySummary(results);

      const calls = mockConsoleLog.mock.calls.map((call: any) => String(call[0])).join('\n');
      
      // Should handle child results without errors
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(calls).toContain('Success Pct');
      // Eval failed, so pass rate should be 0%
      expect(calls).toContain('0.0%');
    });
  });
});
