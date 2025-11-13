import { vibeCheckMatchers } from './matchers';

export { vibeCheckMatchers };

/**
 * Extends Jest with custom vibecheck matchers
 *
 * Usage:
 * ```typescript
 * import { extendExpect } from '@vibecheck/runner/jest';
 *
 * extendExpect(expect);
 * ```
 */
export function extendExpect(expect: any) {
  expect.extend(vibeCheckMatchers);
}
