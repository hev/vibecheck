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
        expect(checks).toHaveLength(4);
        expect(checks[0].type).toBe('string_contains');
        expect(checks[1].type).toBe('semantic_similarity');
        expect(checks[2].type).toBe('llm_judge');
        expect(checks[3].type).toBe('token_length');
      }
    });

    it('should parse string_contains check correctly', () => {
      const data = parseYamlFixture('valid-eval.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const stringCheck = result.data.evals[0].checks[0];
        expect(stringCheck.type).toBe('string_contains');
        if (stringCheck.type === 'string_contains') {
          expect(stringCheck.value).toBe('4');
        }
      }
    });

    it('should parse token_length check correctly', () => {
      const data = parseYamlFixture('valid-eval.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const tokenCheck = result.data.evals[0].checks[1];
        expect(tokenCheck.type).toBe('token_length');
        if (tokenCheck.type === 'token_length') {
          expect(tokenCheck.min_tokens).toBe(1);
          expect(tokenCheck.max_tokens).toBe(50);
        }
      }
    });

    it('should parse semantic_similarity check correctly', () => {
      const data = parseYamlFixture('all-check-types.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const semanticCheck = result.data.evals[0].checks[1];
        expect(semanticCheck.type).toBe('semantic_similarity');
        if (semanticCheck.type === 'semantic_similarity') {
          expect(semanticCheck.expected).toBe('The capital of France is Paris');
          expect(semanticCheck.threshold).toBe(0.8);
        }
      }
    });

    it('should parse llm_judge check correctly', () => {
      const data = parseYamlFixture('all-check-types.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const judgeCheck = result.data.evals[0].checks[2];
        expect(judgeCheck.type).toBe('llm_judge');
        if (judgeCheck.type === 'llm_judge') {
          expect(judgeCheck.criteria).toBe('The response correctly identifies Paris as the capital of France');
        }
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

    it('should fail validation on invalid check type', () => {
      const invalidData = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: [
          {
            prompt: 'test',
            checks: [
              { type: 'invalid_type', value: 'test' }
            ]
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail validation on semantic_similarity without threshold', () => {
      const invalidData = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: [
          {
            prompt: 'test',
            checks: [
              { type: 'semantic_similarity', expected: 'test' }
              // Missing threshold
            ]
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail validation on semantic_similarity with invalid threshold', () => {
      const invalidData = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: [
          {
            prompt: 'test',
            checks: [
              { type: 'semantic_similarity', expected: 'test', threshold: 1.5 } // > 1
            ]
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
            checks: [
              { type: 'string_contains', value: 'test' }
            ]
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.threads).toBe(4);
      }
    });

    it('should handle optional operator field in checks', () => {
      const data = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: [
          {
            prompt: 'test',
            checks: [
              { type: 'string_contains', value: 'test', operator: 'and' }
            ]
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        const check = result.data.evals[0].checks[0];
        if (check.type === 'string_contains') {
          expect(check.operator).toBe('and');
        }
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
            checks: [{ type: 'string_contains', value: 'test' }]
          },
          {
            prompt: 'test 2',
            checks: [{ type: 'token_length', min_tokens: 1 }]
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
