import { describe, it, expect, beforeAll } from '@jest/globals';
import { runVibeCheck } from '../../packages/runner/src';
import { extendExpect } from '../../packages/runner/src/jest';
import { EvalResult } from '../../packages/runner/src/types';
import * as path from 'path';

// Extend Jest with custom matchers
extendExpect(expect);

describe('Example Evaluations', () => {
  // Longer timeout for API calls - extended for parallel execution
  const TEST_TIMEOUT = 180000; // 3 minutes total for parallel runs

  const examples = [
    { name: 'hello-world', expectation: 'basic checks' },
    { name: 'finance', expectation: 'financial knowledge' },
    { name: 'healthcare', expectation: 'medical knowledge' },
    { name: 'lang', expectation: 'multilingual capabilities' },
    { name: 'politics', expectation: 'political knowledge' },
    { name: 'sports', expectation: 'sports knowledge' },
    { name: 'strawberry', expectation: 'reasoning capabilities' }
  ];

  // Store results for each example
  const resultsMap = new Map<string, { results: EvalResult[]; error?: Error }>();

  // Run all examples in parallel before tests
  beforeAll(async () => {
    console.log(`\n🚀 Starting ${examples.length} example evaluations in parallel...\n`);

    const startTime = Date.now();

    // Create an array of promises for parallel execution
    const promises = examples.map(async ({ name }) => {
      const filePath = path.join(__dirname, '..', '..', 'examples', `${name}.yaml`);

      try {
        console.log(`  ⏳ Starting ${name}...`);
        const results = await runVibeCheck({ file: filePath });
        resultsMap.set(name, { results });

        const passed = results.filter(r => r.passed).length;
        const successRate = parseFloat(((passed / results.length) * 100).toFixed(1));
        console.log(`  ✅ Completed ${name}: ${passed}/${results.length} passed (${successRate}%)`);

        return { name, success: true };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        resultsMap.set(name, { results: [], error: err });
        console.error(`  ❌ Failed ${name}:`, err.message);
        return { name, success: false, error: err };
      }
    });

    // Wait for all evaluations to complete
    await Promise.all(promises);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    console.log(`\n✨ All evaluations completed in ${duration}s\n`);
  }, TEST_TIMEOUT);

  // Create individual test cases for each example
  examples.forEach(({ name, expectation }) => {
    it(`should run ${name}.yaml (${expectation})`, () => {
      const result = resultsMap.get(name);

      // Check if we have results for this example
      expect(result).toBeDefined();

      // If there was an error during execution, fail the test
      if (result?.error) {
        console.error(`✗ FAIL: ${name}: Failed with error during parallel execution`);
        throw result.error;
      }

      // Assert that we got results
      expect(result?.results).toBeDefined();
      expect(result?.results.length).toBeGreaterThan(0);

      // Calculate success rate and apply thresholds
      const results = result!.results;
      const passed = results.filter(r => r.passed).length;
      const successRate = parseFloat(((passed / results.length) * 100).toFixed(1));

      // Apply success rate thresholds per README:
      // - FAIL (exit code 1) if success rate < 50%
      // - WARN if success rate < 80%
      // - PASS if success rate >= 80%

      if (successRate < 50) {
        // FAIL: Below 50% threshold
        console.error(`✗ FAIL: ${name}: ${passed}/${results.length} passed (${successRate}%) - Below 50% threshold`);
        throw new Error(`${name} failed with success rate ${successRate}% (threshold: 50%)`);
      } else if (successRate < 80) {
        // WARN: Between 50-80% threshold
        console.warn(`⚠ WARN: ${name}: ${passed}/${results.length} passed (${successRate}%) - Below 80% threshold`);
      } else {
        // PASS: At or above 80% threshold
        console.log(`✓ PASS: ${name}: ${passed}/${results.length} passed (${successRate}%)`);
      }
    });
  });
});
