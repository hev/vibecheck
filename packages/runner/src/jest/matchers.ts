import { EvalResult } from '../types';
import './matchers.d';

function calculateSuccessRate(results: EvalResult[]): number {
  if (results.length === 0) return 0;
  const passedCount = results.filter(r => r.passed).length;
  return (passedCount / results.length) * 100;
}

export const vibeCheckMatchers = {
  toHavePassedAll(received: EvalResult[]) {
    if (!Array.isArray(received)) {
      return {
        pass: false,
        message: () => 'Expected an array of EvalResult objects'
      };
    }

    const failedResults = received.filter(r => !r.passed);
    const pass = failedResults.length === 0;

    if (pass) {
      return {
        pass: true,
        message: () => `Expected some evaluations to fail, but all ${received.length} passed`
      };
    }

    const failureDetails = failedResults.map(r => {
      const failedChecks = r.checkResults.filter(c => !c.passed);
      return `  - "${r.prompt}": ${failedChecks.map(c => c.message).join(', ')}`;
    }).join('\n');

    return {
      pass: false,
      message: () =>
        `Expected all evaluations to pass, but ${failedResults.length} of ${received.length} failed:\n${failureDetails}`
    };
  },

  toHaveSuccessRateAbove(received: EvalResult[], threshold: number) {
    if (!Array.isArray(received)) {
      return {
        pass: false,
        message: () => 'Expected an array of EvalResult objects'
      };
    }

    if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
      return {
        pass: false,
        message: () => 'Threshold must be a number between 0 and 100'
      };
    }

    const successRate = calculateSuccessRate(received);
    const pass = successRate > threshold;

    if (pass) {
      return {
        pass: true,
        message: () =>
          `Expected success rate to be ${threshold}% or below, but it was ${successRate.toFixed(1)}%`
      };
    }

    return {
      pass: false,
      message: () =>
        `Expected success rate to be above ${threshold}%, but it was ${successRate.toFixed(1)}% ` +
        `(${received.filter(r => r.passed).length}/${received.length} passed)`
    };
  },

  toHaveSuccessRateBelow(received: EvalResult[], threshold: number) {
    if (!Array.isArray(received)) {
      return {
        pass: false,
        message: () => 'Expected an array of EvalResult objects'
      };
    }

    if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
      return {
        pass: false,
        message: () => 'Threshold must be a number between 0 and 100'
      };
    }

    const successRate = calculateSuccessRate(received);
    const pass = successRate < threshold;

    if (pass) {
      return {
        pass: true,
        message: () =>
          `Expected success rate to be ${threshold}% or above, but it was ${successRate.toFixed(1)}%`
      };
    }

    return {
      pass: false,
      message: () =>
        `Expected success rate to be below ${threshold}%, but it was ${successRate.toFixed(1)}% ` +
        `(${received.filter(r => r.passed).length}/${received.length} passed)`
    };
  },

  toHavePassedCount(received: EvalResult[], count: number) {
    if (!Array.isArray(received)) {
      return {
        pass: false,
        message: () => 'Expected an array of EvalResult objects'
      };
    }

    if (typeof count !== 'number' || count < 0) {
      return {
        pass: false,
        message: () => 'Count must be a non-negative number'
      };
    }

    const passedCount = received.filter(r => r.passed).length;
    const pass = passedCount === count;

    if (pass) {
      return {
        pass: true,
        message: () =>
          `Expected passed count to not be ${count}, but it was`
      };
    }

    return {
      pass: false,
      message: () =>
        `Expected ${count} evaluations to pass, but ${passedCount} passed`
    };
  },

  toHaveFailedCount(received: EvalResult[], count: number) {
    if (!Array.isArray(received)) {
      return {
        pass: false,
        message: () => 'Expected an array of EvalResult objects'
      };
    }

    if (typeof count !== 'number' || count < 0) {
      return {
        pass: false,
        message: () => 'Count must be a non-negative number'
      };
    }

    const failedCount = received.filter(r => !r.passed).length;
    const pass = failedCount === count;

    if (pass) {
      return {
        pass: true,
        message: () =>
          `Expected failed count to not be ${count}, but it was`
      };
    }

    return {
      pass: false,
      message: () =>
        `Expected ${count} evaluations to fail, but ${failedCount} failed`
    };
  }
};
