import { describe, it, expect } from '@jest/globals';
import { runVibeCheck } from '../../packages/runner/src';
import { extendExpect } from '../../packages/runner/src/jest';
import * as path from 'path';

// Extend Jest with custom matchers
extendExpect(expect);

describe('Example Evaluations', () => {
  // Longer timeout for API calls
  const TEST_TIMEOUT = 120000; // 2 minutes per test

  const examples = [
    { name: 'hello-world', expectation: 'basic checks' },
    { name: 'finance', expectation: 'financial knowledge' },
    { name: 'healthcare', expectation: 'medical knowledge' },
    { name: 'lang', expectation: 'multilingual capabilities' },
    { name: 'politics', expectation: 'political knowledge' },
    { name: 'sports', expectation: 'sports knowledge' },
    { name: 'strawberry', expectation: 'reasoning capabilities' }
  ];

  // Run all examples
  examples.forEach(({ name, expectation }) => {
    it(`should run ${name}.yaml (${expectation})`, async () => {
        const filePath = path.join(__dirname, '..', '..', 'examples', `${name}.yaml`);

        try {
          const results = await runVibeCheck({ file: filePath });

          // Assert that we got results
          expect(results).toBeDefined();
          expect(results.length).toBeGreaterThan(0);

          // Log summary for visibility
          const passed = results.filter(r => r.passed).length;
          const successRate = ((passed / results.length) * 100).toFixed(1);
          console.log(`✓ ${name}: ${passed}/${results.length} passed (${successRate}%)`);

          // We don't fail on low success rates here - these are just running examples
          // to verify the runner works. The examples themselves define their own
          // pass/fail criteria.
        } catch (error) {
          console.error(`✗ ${name}: Failed with error:`, error);
          throw error;
        }
      }, TEST_TIMEOUT);
    });
});
