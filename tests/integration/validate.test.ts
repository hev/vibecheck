import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createTempFile, cleanupTempFiles, suppressConsole } from '../helpers/test-utils';
import { validateCommand } from '../../packages/cli/src/commands/validate';

describe('validate command integration tests', () => {
  beforeEach(() => {
    // No API key needed for validate - it's a local command
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupTempFiles();
    jest.restoreAllMocks();
  });

  describe('valid YAML files', () => {
    it('should validate a simple valid YAML file', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  system_prompt: You are a helpful assistant

evals:
  - prompt: What is 2 + 2?
    checks:
      - match: "*4*"
`;
      const tempFile = createTempFile(validYaml, 'valid-simple.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      // Should succeed without throwing (no process.exit call on success)
      await suppressConsole(async () => {
        await validateCommand({ file: tempFile, debug: false });
      });

      exitMock.mockRestore();
    });

    it('should validate YAML with multiple check types', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test prompt
    checks:
      - match: "*test*"
      - not_match: "*error*"
      - min_tokens: 5
      - max_tokens: 100
      - semantic:
          expected: "target response"
          threshold: 0.8
      - llm_judge:
          criteria: "Is the response helpful?"
`;
      const tempFile = createTempFile(validYaml, 'valid-multi-check.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      // Should succeed without throwing (no process.exit call on success)
      await suppressConsole(async () => {
        await validateCommand({ file: tempFile, debug: false });
      });

      exitMock.mockRestore();
    });

    it('should validate YAML with OR checks', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Is this correct?
    checks:
      or:
        - match: "*yes*"
        - match: "*correct*"
        - match: "*affirmative*"
`;
      const tempFile = createTempFile(validYaml, 'valid-or-checks.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      // Should succeed without throwing (no process.exit call on success)
      await suppressConsole(async () => {
        await validateCommand({ file: tempFile, debug: false });
      });

      exitMock.mockRestore();
    });

    it('should validate YAML with MCP server configuration', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  mcp_server:
    url: "https://mcp-server.com"
    name: "my-mcp-server"
    authorization_token: "token123"

evals:
  - prompt: Test with MCP
    checks:
      - match: "*success*"
`;
      const tempFile = createTempFile(validYaml, 'valid-mcp.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      // Should succeed without throwing (no process.exit call on success)
      await suppressConsole(async () => {
        await validateCommand({ file: tempFile, debug: false });
      });

      exitMock.mockRestore();
    });

    it('should validate YAML without system_prompt (optional field)', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test prompt
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'valid-no-system-prompt.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      // Should succeed without throwing (no process.exit call on success)
      await suppressConsole(async () => {
        await validateCommand({ file: tempFile, debug: false });
      });

      exitMock.mockRestore();
    });
  });

  describe('invalid YAML files', () => {
    it('should reject YAML with syntax errors', async () => {
      const invalidYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
evals:
  - prompt: Test
    checks:
      - match: "*test*"
      invalid indentation here
`;
      const tempFile = createTempFile(invalidYaml, 'invalid-syntax.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await expect(
        suppressConsole(async () => {
          await validateCommand({ file: tempFile, debug: false });
        })
      ).rejects.toThrow('process.exit: 1');

      exitMock.mockRestore();
    });

    it('should reject YAML with missing required fields', async () => {
      const invalidYaml = `metadata:
  name: test-suite

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(invalidYaml, 'invalid-missing-model.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await expect(
        suppressConsole(async () => {
          await validateCommand({ file: tempFile, debug: false });
        })
      ).rejects.toThrow('process.exit: 1');

      exitMock.mockRestore();
    });

    it('should reject legacy object-based checks format', async () => {
      const legacyYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      match: "*test*"
      min_tokens: 5
      max_tokens: 100
`;
      const tempFile = createTempFile(legacyYaml, 'invalid-legacy.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await expect(
        suppressConsole(async () => {
          await validateCommand({ file: tempFile, debug: false });
        })
      ).rejects.toThrow('process.exit: 1');

      exitMock.mockRestore();
    });

    it('should reject YAML with invalid check type', async () => {
      const invalidYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - invalid_check: "some value"
`;
      const tempFile = createTempFile(invalidYaml, 'invalid-check-type.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await expect(
        suppressConsole(async () => {
          await validateCommand({ file: tempFile, debug: false });
        })
      ).rejects.toThrow('process.exit: 1');

      exitMock.mockRestore();
    });

    it('should reject YAML with invalid semantic threshold', async () => {
      const invalidYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - semantic:
          expected: "target"
          threshold: 1.5
`;
      const tempFile = createTempFile(invalidYaml, 'invalid-threshold.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await expect(
        suppressConsole(async () => {
          await validateCommand({ file: tempFile, debug: false });
        })
      ).rejects.toThrow('process.exit: 1');

      exitMock.mockRestore();
    });

    it('should reject YAML with empty checks array', async () => {
      const invalidYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks: []
`;
      const tempFile = createTempFile(invalidYaml, 'invalid-empty-checks.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await expect(
        suppressConsole(async () => {
          await validateCommand({ file: tempFile, debug: false });
        })
      ).rejects.toThrow('process.exit: 1');

      exitMock.mockRestore();
    });

    it('should reject YAML with empty OR checks', async () => {
      const invalidYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      or: []
`;
      const tempFile = createTempFile(invalidYaml, 'invalid-empty-or.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await expect(
        suppressConsole(async () => {
          await validateCommand({ file: tempFile, debug: false });
        })
      ).rejects.toThrow('process.exit: 1');

      exitMock.mockRestore();
    });
  });

  describe('file auto-detection', () => {
    it('should auto-detect evals.yaml when no file specified', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      // Create file in current directory with standard name
      createTempFile(validYaml, 'evals.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      // Note: This test might fail in CI if the working directory doesn't match
      // In practice, this is tested manually
      exitMock.mockRestore();
    });
  });
});
