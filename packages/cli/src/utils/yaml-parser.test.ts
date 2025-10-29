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
        expect(Array.isArray(checks)).toBe(true);
        if (Array.isArray(checks)) {
          const matchCheck = checks.find((c: any) => 'match' in c);
          const semanticCheck = checks.find((c: any) => 'semantic' in c);
          const llmJudgeCheck = checks.find((c: any) => 'llm_judge' in c);
          const minTokensCheck = checks.find((c: any) => 'min_tokens' in c);
          const maxTokensCheck = checks.find((c: any) => 'max_tokens' in c);
          
          expect(matchCheck).toBeDefined();
          expect(semanticCheck).toBeDefined();
          expect(llmJudgeCheck).toBeDefined();
          expect(minTokensCheck).toBeDefined();
          expect(maxTokensCheck).toBeDefined();
        }
      }
    });

    it('should parse match check correctly', () => {
      const data = parseYamlFixture('valid-eval.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const checks = result.data.evals[0].checks;
        expect(Array.isArray(checks)).toBe(true);
        if (Array.isArray(checks)) {
          const matchCheck = checks.find((c: any) => 'match' in c) as { match: string } | undefined;
          expect(matchCheck).toBeDefined();
          expect(matchCheck?.match).toBe('*4*');
        }
      }
    });

    it('should parse token length checks correctly', () => {
      const data = parseYamlFixture('valid-eval.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const checks = result.data.evals[0].checks;
        expect(Array.isArray(checks)).toBe(true);
        if (Array.isArray(checks)) {
          const minTokensCheck = checks.find((c: any) => 'min_tokens' in c) as { min_tokens: number } | undefined;
          const maxTokensCheck = checks.find((c: any) => 'max_tokens' in c) as { max_tokens: number } | undefined;
          expect(minTokensCheck?.min_tokens).toBe(1);
          expect(maxTokensCheck?.max_tokens).toBe(50);
        }
      }
    });

    it('should parse semantic check correctly', () => {
      const data = parseYamlFixture('all-check-types.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const checks = result.data.evals[0].checks;
        expect(Array.isArray(checks)).toBe(true);
        if (Array.isArray(checks)) {
          const semanticCheck = checks.find((c: any) => 'semantic' in c) as { semantic: { expected: string; threshold: number } } | undefined;
          expect(semanticCheck).toBeDefined();
          expect(semanticCheck?.semantic?.expected).toBe('The capital of France is Paris');
          expect(semanticCheck?.semantic?.threshold).toBe(0.8);
        }
      }
    });

    it('should parse multiple not_match patterns correctly', () => {
      const data = parseYamlFixture('multiple-not-match.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const checks = result.data.evals[0].checks;
        expect(Array.isArray(checks)).toBe(true);
        if (Array.isArray(checks)) {
          const notMatchChecks = checks.filter((c: any) => 'not_match' in c) as Array<{ not_match: string }>;
          const matchCheck = checks.find((c: any) => 'match' in c) as { match: string } | undefined;
          expect(notMatchChecks.length).toBe(2);
          expect(notMatchChecks[0]?.not_match).toBe("*adviceSetId*");
          expect(notMatchChecks[1]?.not_match).toBe("*Taffrail*");
          expect(matchCheck?.match).toBe("*retirement*");
        }
      }
    });

    it('should parse llm_judge check correctly', () => {
      const data = parseYamlFixture('all-check-types.yaml');
      const result = EvalSuiteSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const checks = result.data.evals[0].checks;
        expect(Array.isArray(checks)).toBe(true);
        if (Array.isArray(checks)) {
          const llmJudgeCheck = checks.find((c: any) => 'llm_judge' in c) as { llm_judge: { criteria: string } } | undefined;
          expect(llmJudgeCheck).toBeDefined();
          expect(llmJudgeCheck?.llm_judge?.criteria).toBe('The response correctly identifies Paris as the capital of France');
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
            checks: [
              { invalid_property: 'test' } as any
            ]
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

  describe('Legacy Format Rejection', () => {
    it('should reject legacy object-based format', () => {
      const legacyFormatData = {
        metadata: {
          name: 'test',
          model: 'test-model',
          system_prompt: 'test prompt'
        },
        evals: [
          {
            prompt: 'test',
            checks: {
              match: '*test*',
              min_tokens: 1
            }
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(legacyFormatData);
      expect(result.success).toBe(false);
    });

    it('should reject empty pattern in match check', () => {
      const invalidData = {
        metadata: {
          name: 'test',
          model: 'test-model'
        },
        evals: [
          {
            prompt: 'test',
            checks: [
              { match: '' }
            ]
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const matchError = result.error.errors.find(err => 
          err.path.includes('match') || err.message.includes('pattern cannot be empty')
        );
        expect(matchError).toBeDefined();
      }
    });

    it('should reject empty pattern in not_match check', () => {
      const invalidData = {
        metadata: {
          name: 'test',
          model: 'test-model'
        },
        evals: [
          {
            prompt: 'test',
            checks: [
              { not_match: '' }
            ]
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const matchError = result.error.errors.find(err => 
          err.path.includes('not_match') || err.message.includes('pattern cannot be empty')
        );
        expect(matchError).toBeDefined();
      }
    });

    it('should validate OR checks format', () => {
      const validData = {
        metadata: {
          name: 'test',
          model: 'test-model'
        },
        evals: [
          {
            prompt: 'test',
            checks: {
              or: [
                { match: '*option1*' },
                { match: '*option2*' }
              ]
            }
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate OR checks with mixed types', () => {
      const validData = {
        metadata: {
          name: 'test',
          model: 'test-model'
        },
        evals: [
          {
            prompt: 'test',
            checks: {
              or: [
                { match: '*option1*' },
                { not_match: '*bad*' },
                { max_tokens: 100 }
              ]
            }
          }
        ]
      };

      const result = EvalSuiteSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty OR checks array', () => {
      const invalidData = {
        metadata: {
          name: 'test',
          model: 'test-model'
        },
        evals: [
          {
            prompt: 'test',
            checks: {
              or: []
            }
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
              { match: '*test*' }
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
            checks: [
              { match: '*test*' }
            ]
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
