import { EvalResult } from '../types';

declare global {
  namespace jest {
    interface Matchers<R> {
      toHavePassedAll(): R;
      toHaveSuccessRateAbove(threshold: number): R;
      toHaveSuccessRateBelow(threshold: number): R;
      toHavePassedCount(count: number): R;
      toHaveFailedCount(count: number): R;
    }
  }
}

export {};
