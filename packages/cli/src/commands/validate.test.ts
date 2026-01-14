import { describe, it, expect, jest } from '@jest/globals';
import * as fs from 'fs';
import { validateCommand } from './validate';

// Mock dependencies
jest.mock('fs');
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    text: ''
  }));
});

const mockFs = fs as jest.Mocked<typeof fs>;

describe('validate command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset process.exit mock
    jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit: ${code}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('file detection', () => {
    it('should auto-detect evals.yaml', async () => {
      mockFs.existsSync = jest.fn((path: any) => {
        return path === './evals.yaml';
      }) as any;

      const validYaml = `
metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
evals:
  - prompt: Test prompt
    checks:
      - match: "*test*"
`;
      mockFs.readFileSync = jest.fn().mockReturnValue(validYaml);

      await expect(validateCommand({ debug: false })).rejects.toThrow('process.exit: 0');
      expect(mockFs.existsSync).toHaveBeenCalledWith('./evals.yaml');
    });

    it('should use specified file', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);

      const validYaml = `
metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
evals:
  - prompt: Test prompt
    checks:
      - match: "*test*"
`;
      mockFs.readFileSync = jest.fn().mockReturnValue(validYaml);

      await expect(validateCommand({ file: 'custom.yaml', debug: false })).rejects.toThrow('process.exit: 0');
      expect(mockFs.existsSync).toHaveBeenCalledWith('custom.yaml');
    });

    it('should fail if no file found', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(false);

      await expect(validateCommand({ debug: false })).rejects.toThrow('process.exit: 1');
    });

    it('should fail if specified file does not exist', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(false);

      await expect(validateCommand({ file: 'nonexistent.yaml', debug: false })).rejects.toThrow('process.exit: 1');
    });
  });

  describe('YAML validation', () => {
    it('should validate correct YAML', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);

      const validYaml = `
metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  system_prompt: You are a helpful assistant
evals:
  - prompt: Test prompt
    checks:
      - match: "*test*"
      - min_tokens: 1
      - max_tokens: 100
`;
      mockFs.readFileSync = jest.fn().mockReturnValue(validYaml);

      await expect(validateCommand({ file: 'test.yaml', debug: false })).rejects.toThrow('process.exit: 0');
    });

    it('should fail on invalid YAML syntax', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);

      const invalidYaml = `
metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
evals:
  - prompt: Test prompt
    checks:
      - match: "*test*"
      invalid indentation
`;
      mockFs.readFileSync = jest.fn().mockReturnValue(invalidYaml);

      await expect(validateCommand({ file: 'test.yaml', debug: false })).rejects.toThrow('process.exit: 1');
    });

    it('should fail on missing required fields', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);

      const invalidYaml = `
metadata:
  name: test-suite
evals:
  - prompt: Test prompt
    checks:
      - match: "*test*"
`;
      mockFs.readFileSync = jest.fn().mockReturnValue(invalidYaml);

      await expect(validateCommand({ file: 'test.yaml', debug: false })).rejects.toThrow('process.exit: 1');
    });

    it('should fail on legacy object-based checks format', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);

      const legacyYaml = `
metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
evals:
  - prompt: Test prompt
    checks:
      match: "*test*"
      min_tokens: 1
      max_tokens: 100
`;
      mockFs.readFileSync = jest.fn().mockReturnValue(legacyYaml);

      await expect(validateCommand({ file: 'test.yaml', debug: false })).rejects.toThrow('process.exit: 1');
    });

    it('should validate OR checks', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);

      const validYaml = `
metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
evals:
  - prompt: Test prompt
    checks:
      or:
        - match: "*yes*"
        - match: "*ok*"
`;
      mockFs.readFileSync = jest.fn().mockReturnValue(validYaml);

      await expect(validateCommand({ file: 'test.yaml', debug: false })).rejects.toThrow('process.exit: 0');
    });

    it('should validate semantic checks', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);

      const validYaml = `
metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
evals:
  - prompt: Test prompt
    checks:
      - semantic:
          expected: "target response"
          threshold: 0.8
`;
      mockFs.readFileSync = jest.fn().mockReturnValue(validYaml);

      await expect(validateCommand({ file: 'test.yaml', debug: false })).rejects.toThrow('process.exit: 0');
    });

    it('should validate llm_judge checks', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);

      const validYaml = `
metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
evals:
  - prompt: Test prompt
    checks:
      - llm_judge:
          criteria: "Check if response is helpful"
`;
      mockFs.readFileSync = jest.fn().mockReturnValue(validYaml);

      await expect(validateCommand({ file: 'test.yaml', debug: false })).rejects.toThrow('process.exit: 0');
    });

    it('should validate MCP server configuration', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);

      const validYaml = `
metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  mcp_server:
    url: "https://mcp-server.com"
    name: "my-server"
    authorization_token: "token123"
evals:
  - prompt: Test prompt
    checks:
      - match: "*test*"
`;
      mockFs.readFileSync = jest.fn().mockReturnValue(validYaml);

      await expect(validateCommand({ file: 'test.yaml', debug: false })).rejects.toThrow('process.exit: 0');
    });
  });
});
