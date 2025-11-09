import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { configureAxiosForTests } from '../helpers/test-utils';
import { writeRunOutput } from '../../packages/cli/src/utils/output-writer';
import { EvalResult } from '../../packages/cli/src/types';

// Mock the string-width module
jest.mock('string-width', () => ({
  __esModule: true,
  default: (str: string) => str.length
}));

describe('Run Output Saving', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let axiosCleanup: (() => void) | undefined;

  beforeEach(() => {
    // Configure axios to not keep connections alive
    axiosCleanup = configureAxiosForTests();
    // Create a temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecheck-test-'));
    originalEnv = { ...process.env };
    process.env.VIBECHECK_OUTPUT_DIR = tempDir;
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    process.env = originalEnv;
    // Cleanup must happen in order: nock first, then axios agents
    await cleanupApiMocks();
    if (axiosCleanup) {
      await axiosCleanup();
      axiosCleanup = undefined;
    }
  });

  const createMockResults = (): EvalResult[] => [
    {
      evalName: 'math-question',
      prompt: 'What is 2+2?',
      response: '2+2 equals 4',
      passed: true,
      executionTimeMs: 1500,
      checkResults: [
        {
          type: 'match',
          passed: true,
          message: 'Found pattern "4"'
        },
        {
          type: 'min_tokens',
          passed: true,
          message: 'Token count 4 (min: 3)'
        }
      ]
    },
    {
      evalName: 'geography-question',
      prompt: 'What is the capital of France?',
      response: 'The capital of France is Paris',
      passed: true,
      executionTimeMs: 2000,
      checkResults: [
        {
          type: 'match',
          passed: true,
          message: 'Found pattern "Paris"'
        }
      ]
    }
  ];

  const mockYamlContent = `metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: What is 2+2?
    checks:
      match: "*4*"
      min_tokens: 3
  - prompt: What is the capital of France?
    checks:
      match: "*Paris*"`;

  describe('writeRunOutput utility', () => {
    it('should create output directory if it does not exist', async () => {
      const customDir = path.join(tempDir, 'custom-runs');
      
      await writeRunOutput({
        runId: 'test-run-1',
        results: createMockResults(),
        yamlContent: mockYamlContent,
        outputDir: customDir
      });

      expect(fs.existsSync(customDir)).toBe(true);
    });

    it('should save run output to correct file path', async () => {
      const runId = 'test-run-123';
      const results = createMockResults();
      
      const outputPath = await writeRunOutput({
        runId,
        results,
        yamlContent: mockYamlContent
      });

      expect(outputPath).toBe(path.join(tempDir, `${runId}.txt`));
      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should include all required sections in output file', async () => {
      const runId = 'test-run-sections';
      const results = createMockResults();
      const runLog = ['Eval 1: Processing...', 'Eval 2: Processing...'];
      
      const outputPath = await writeRunOutput({
        runId,
        results,
        totalTimeMs: 5000,
        yamlContent: mockYamlContent,
        runLog
      });

      const content = fs.readFileSync(outputPath, 'utf8');
      
      // Check for all required sections
      expect(content).toContain('VIBECHECK RUN OUTPUT');
      expect(content).toContain(`Run ID: ${runId}`);
      expect(content).toContain('EVALUATION YAML');
      expect(content).toContain('EXECUTION LOG');
      expect(content).toContain('SUMMARY');
      expect(content).toContain('Success Pct:');
      expect(content).toContain('Total Time: 5.00s');
    });

    it('should include YAML content when provided', async () => {
      const runId = 'test-run-yaml';
      const results = createMockResults();
      
      await writeRunOutput({
        runId,
        results,
        yamlContent: mockYamlContent
      });

      const content = fs.readFileSync(path.join(tempDir, `${runId}.txt`), 'utf8');
      expect(content).toContain('metadata:');
      expect(content).toContain('name: test-suite');
      expect(content).toContain('evals:');
    });

    it('should include run log when provided', async () => {
      const runId = 'test-run-log';
      const results = createMockResults();
      const runLog = ['Step 1: Starting evaluation', 'Step 2: Processing results'];
      
      await writeRunOutput({
        runId,
        results,
        runLog
      });

      const content = fs.readFileSync(path.join(tempDir, `${runId}.txt`), 'utf8');
      expect(content).toContain('Step 1: Starting evaluation');
      expect(content).toContain('Step 2: Processing results');
    });

    it('should generate execution log from results when no runLog provided', async () => {
      const runId = 'test-run-auto-log';
      const results = createMockResults();
      
      await writeRunOutput({
        runId,
        results
      });

      const content = fs.readFileSync(path.join(tempDir, `${runId}.txt`), 'utf8');
      expect(content).toContain('Eval 1: What is 2+2?');
      expect(content).toContain('Eval 2: What is the capital of France?');
      expect(content).toContain('Status: PASS');
      expect(content).toContain('Checks: 2/2 passed');
    });

    it('should calculate correct success percentage', async () => {
      const runId = 'test-run-rating';
      const results = createMockResults(); // Both passed
      
      await writeRunOutput({
        runId,
        results
      });

      const content = fs.readFileSync(path.join(tempDir, `${runId}.txt`), 'utf8');
      expect(content).toContain('Success Pct: 2/2 (100.0%)');
    });

    it('should handle failed evaluations correctly', async () => {
      const runId = 'test-run-failed';
      const results: EvalResult[] = [
        {
          evalName: 'test-failed',
          prompt: 'Test prompt',
          response: 'Wrong answer',
          passed: false,
          executionTimeMs: 1000,
          checkResults: [
            {
              type: 'match',
              passed: false,
              message: 'Pattern not found'
            }
          ]
        }
      ];
      
      await writeRunOutput({
        runId,
        results
      });

      const content = fs.readFileSync(path.join(tempDir, `${runId}.txt`), 'utf8');
      expect(content).toContain('Success Pct: 0/1 (0.0%)');
    });

    it('should handle 50% pass rate correctly', async () => {
      const runId = 'test-run-sketchy';
      const results: EvalResult[] = [
        {
          evalName: 'test-passed',
          prompt: 'Test prompt 1',
          response: 'Correct answer',
          passed: true,
          executionTimeMs: 1000,
          checkResults: [{ type: 'match', passed: true, message: 'Found' }]
        },
        {
          evalName: 'test-failed',
          prompt: 'Test prompt 2',
          response: 'Wrong answer',
          passed: false,
          executionTimeMs: 1000,
          checkResults: [{ type: 'match', passed: false, message: 'Not found' }]
        }
      ];
      
      await writeRunOutput({
        runId,
        results
      });

      const content = fs.readFileSync(path.join(tempDir, `${runId}.txt`), 'utf8');
      expect(content).toContain('Success Pct: 1/2 (50.0%)');
    });

    it('should use custom output directory from environment variable', async () => {
      const customDir = path.join(tempDir, 'env-custom');
      process.env.VIBECHECK_OUTPUT_DIR = customDir;
      
      await writeRunOutput({
        runId: 'test-env-dir',
        results: createMockResults()
      });

      expect(fs.existsSync(customDir)).toBe(true);
      expect(fs.existsSync(path.join(customDir, 'test-env-dir.txt'))).toBe(true);
    });

    it('should use default directory when no custom directory specified', async () => {
      delete process.env.VIBECHECK_OUTPUT_DIR;
      
      await writeRunOutput({
        runId: 'test-default-dir',
        results: createMockResults()
      });

      const defaultDir = path.join(os.homedir(), '.vibecheck', 'runs');
      expect(fs.existsSync(path.join(defaultDir, 'test-default-dir.txt'))).toBe(true);
      
      // Clean up default directory
      if (fs.existsSync(defaultDir)) {
        fs.rmSync(defaultDir, { recursive: true, force: true });
      }
    });

    it('should handle multiple runs with unique file names', async () => {
      const runId1 = 'test-run-1';
      const runId2 = 'test-run-2';
      const results = createMockResults();
      
      await writeRunOutput({
        runId: runId1,
        results
      });
      
      await writeRunOutput({
        runId: runId2,
        results
      });

      expect(fs.existsSync(path.join(tempDir, `${runId1}.txt`))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, `${runId2}.txt`))).toBe(true);
      
      // Files should have different content (different run IDs)
      const content1 = fs.readFileSync(path.join(tempDir, `${runId1}.txt`), 'utf8');
      const content2 = fs.readFileSync(path.join(tempDir, `${runId2}.txt`), 'utf8');
      
      expect(content1).toContain(`Run ID: ${runId1}`);
      expect(content2).toContain(`Run ID: ${runId2}`);
    });

    it('should throw error when file write fails', async () => {
      // Skip this test when running as root (e.g., in Docker/CI)
      // Root can write to read-only directories, making this test unreliable
      if (process.getuid && process.getuid() === 0) {
        console.log('Skipping read-only test when running as root');
        return;
      }

      // Create a read-only directory to simulate write failure
      const readOnlyDir = path.join(tempDir, 'readonly');
      fs.mkdirSync(readOnlyDir);
      fs.chmodSync(readOnlyDir, 0o444);

      await expect(writeRunOutput({
        runId: 'test-readonly',
        results: createMockResults(),
        outputDir: readOnlyDir
      })).rejects.toThrow('Failed to write output file');
    });
  });

  describe('Integration with CLI commands', () => {
    it('should save outputs', async () => {
      // This would require running the actual CLI command, which is complex to test
      // For now, we'll test that the utility function works as expected
      const outputPath = await writeRunOutput({
        runId: 'integration-test',
        results: createMockResults(),
        yamlContent: mockYamlContent
      });

      expect(fs.existsSync(outputPath)).toBe(true);
    });
  });
});
