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

      // Check for vibe status message (100% pass rate)
      const calls = mockConsoleLog.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('good vibes');
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
      expect(calls).toContain('bad vibes');
      expect(calls).toContain('0.0%');
    });

    it('should display summary for mixed results (sketchy vibes)', async () => {
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
      expect(calls).toContain('sketchy vibes');
      expect(calls).toContain('80.0%');
    });

    it('should display summary for results below 80% (bad vibes)', async () => {
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
      expect(calls).toContain('bad vibes');
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
      expect(calls).toContain('bad vibes');

      mockConsoleLog.mockClear();

      // Test 2: 3 out of 3 passed (100%)
      const results2: EvalResult[] = results1.map(r => ({ ...r, passed: true }));
      await displaySummary(results2);
      calls = mockConsoleLog.mock.calls.map((call: any) => String(call[0])).join('\n');
      expect(calls).toContain('100.0%');
      expect(calls).toContain('good vibes');
    });
  });
});
