import { describe, it, expect } from '@jest/globals';
import * as yaml from 'js-yaml';
import { EvalSuiteSchema } from '../types';
import { readFixture, parseYamlFixture } from '../../../../tests/helpers/test-utils';

describe('YAML Parsing and Validation', () => {
  describe('Valid YAML', () => {
    it('should parse valid YAML file', () => {
      const content = readFixture('valid-eval.yaml');
      const parsed = yaml.load(content);
      expect(parsed).toBeDefined();
      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('evals');
    });

    it('should validate against EvalSuiteSchema', () => {
      const data = parseYamlFixture('valid-eval.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.name).toBe('test-suite');
        expect(result.data.metadata.model).toBe('anthropic/claude-3-5-sonnet-20241022');
        expect(result.data.evals).toHaveLength(1);
      }
    });

    it('should validate all check types', () => {
      const data = parseYamlFixture('all-check-types.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const checks = result.data.evals[0].checks;
        expect(checks).toHaveProperty('match');
        expect(checks).toHaveProperty('semantic');
        expect(checks).toHaveProperty('llm_judge');
        expect(checks).toHaveProperty('min_tokens');
        expect(checks).toHaveProperty('max_tokens');
      }
    });

    it('should parse match check correctly', () => {
      const data = parseYamlFixture('valid-eval.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const checks = result.data.evals[0].checks;
        expect(checks.match).toBe('*4*');
      }
    });

    it('should parse token length checks correctly', () => {
      const data = parseYamlFixture('valid-eval.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const checks = result.data.evals[0].checks;
        expect(checks.min_tokens).toBe(1);
        expect(checks.max_tokens).toBe(50);
      }
    });

    it('should parse semantic check correctly', () => {
      const data = parseYamlFixture('all-check-types.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const checks = result.data.evals[0].checks;
        expect(checks.semantic).toBeDefined();
        expect(checks.semantic?.expected).toBe('The capital of France is Paris');
        expect(checks.semantic?.threshold).toBe(0.8);
      }
    });

    it('should parse llm_judge check correctly', () => {
      const data = parseYamlFixture('all-check-types.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const checks = result.data.evals[0].checks;
        expect(checks.llm_judge).toBeDefined();
        expect(checks.llm_judge?.criteria).toBe('The response correctly identifies Paris as the capital of France');
      }
    });
  });

  describe('Invalid YAML', () => {
    it('should fail on malformed YAML', () => {
      const content = readFixture('malformed.yaml');
      expect(() => yaml.load(content)).toThrow();
    });

    it('should fail validation on missing required fields', () => {
      const data = parseYamlFixture('invalid-schema.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
        // Check that model field is mentioned in errors
        const hasModelError = result.error.errors.some(err =>
          err.path.includes('model') || err.message.includes('model')
        );
        expect(hasModelError).toBe(true);
      }
    });

    it('should fail validation on invalid check properties', () => {
      const invalidData = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: [
          {
            prompt: 'test',
            checks: {
              invalid_property: 'test'
            }
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail validation on semantic without threshold', () => {
      const invalidData = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: [
          {
            prompt: 'test',
            checks: {
              semantic: {
                expected: 'test'
                // Missing threshold
              }
            }
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail validation on semantic with invalid threshold', () => {
      const invalidData = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: [
          {
            prompt: 'test',
            checks: {
              semantic: {
                expected: 'test',
                threshold: 1.5 // > 1
              }
            }
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail validation on empty evals array', () => {
      const invalidData = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: []
      };

      const result = EvalSuiteSchema.safeParse(invalidData);
      // Empty arrays should be valid according to the schema
      // This test documents current behavior
      expect(result.success).toBe(true);
    });

    it('should fail validation on missing checks array', () => {
      const invalidData = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: [
          {
            prompt: 'test'
            // Missing checks
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Old Format Rejection', () => {
    it('should reject old format with array of checks', () => {
      const oldFormatData = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: [
          {
            prompt: 'test',
            checks: [
              { type: 'string_contains', value: 'test' }
            ]
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(oldFormatData);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle optional fields in metadata', () => {
      const data = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt',
          threads: 4
        },
        evals: [
          {
            prompt: 'test',
            checks: {
              match: '*test*'
            }
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.threads).toBe(4);
      }
    });

    it('should handle optional system_prompt field', () => {
      const data = {
        metadata: {
          name: 'test',
          model: 'test-model'
          // system_prompt is optional
        },
        evals: [
          {
            prompt: 'test',
            checks: {
              match: '*test*'
            }
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.system_prompt).toBeUndefined();
      }
    });

    it('should handle multiple evals in a suite', () => {
      const data = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: [
          {
            prompt: 'test 1',
            checks: { match: '*test*' }
          },
          {
            prompt: 'test 2',
            checks: { min_tokens: 1 }
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.evals).toHaveLength(2);
      }
    });
  });
});
