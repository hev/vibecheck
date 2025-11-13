import { describe, it, expect } from '@jest/globals';
import { YamlLoader } from '../../src/utils/yaml-loader';
import * as path from 'path';

describe('YamlLoader', () => {
  describe('loadFile', () => {
    it('should load and validate a valid YAML file', () => {
      const filePath = path.join(__dirname, '../fixtures/valid-eval.yaml');
      const { suite, content } = YamlLoader.loadFile(filePath);

      expect(suite).toBeDefined();
      expect(suite.metadata.name).toBe('test-eval');
      expect(suite.metadata.model).toBe('anthropic/claude-3.5-sonnet');
      expect(suite.evals).toHaveLength(1);
      expect(content).toContain('metadata:');
    });

    it('should throw error for non-existent file', () => {
      expect(() => {
        YamlLoader.loadFile('/non/existent/file.yaml');
      }).toThrow('File not found');
    });
  });

  describe('parseYaml', () => {
    it('should parse valid YAML content', () => {
      const content = `
metadata:
  name: test
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Test prompt
    checks:
      - match: "*test*"
`;
      const { suite } = YamlLoader.parseYaml(content);

      expect(suite.metadata.name).toBe('test');
      expect(suite.evals).toHaveLength(1);
    });

    it('should throw error for invalid YAML syntax', () => {
      const content = 'invalid: yaml: content:';
      expect(() => {
        YamlLoader.parseYaml(content);
      }).toThrow('YAML syntax error');
    });

    it('should throw error for missing required fields', () => {
      const content = `
metadata:
  name: test
evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      expect(() => {
        YamlLoader.parseYaml(content);
      }).toThrow('Invalid YAML format');
    });

    it('should reject legacy object-based format', () => {
      const content = `
metadata:
  name: test
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Test
    checks:
      match: "*test*"
      min_tokens: 1
`;
      expect(() => {
        YamlLoader.parseYaml(content);
      }).toThrow('legacy format');
    });

    it('should accept OR checks', () => {
      const content = `
metadata:
  name: test
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Test
    checks:
      or:
        - match: "*option1*"
        - match: "*option2*"
`;
      const { suite } = YamlLoader.parseYaml(content);
      expect(suite.evals[0].checks).toHaveProperty('or');
    });
  });
});
