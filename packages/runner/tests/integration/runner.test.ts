import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import nock from 'nock';
import { VibeCheckRunner, runVibeCheck } from '../../src';
import * as path from 'path';

const API_URL = 'https://vibecheck-api-prod-681369865361.us-central1.run.app';
const API_KEY = 'test-api-key';

describe.skip('VibeCheckRunner Integration', () => {
  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();
    // Set test API key
    process.env.VIBECHECK_API_KEY = API_KEY;
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    delete process.env.VIBECHECK_API_KEY;
  });

  describe('constructor', () => {
    it('should create runner with provided API key', () => {
      const runner = new VibeCheckRunner({ apiKey: 'custom-key' });
      expect(runner).toBeInstanceOf(VibeCheckRunner);
    });

    it('should create runner with environment API key', () => {
      const runner = new VibeCheckRunner();
      expect(runner).toBeInstanceOf(VibeCheckRunner);
    });

    it('should throw error without API key', () => {
      delete process.env.VIBECHECK_API_KEY;
      expect(() => {
        new VibeCheckRunner();
      }).toThrow('API key is required');
    });
  });

  describe('run', () => {
    it('should run evaluation from file', async () => {
      const runId = 'test-run-id';
      const mockResults = [
        {
          evalName: 'Test eval',
          prompt: 'What is 2+2?',
          response: '4',
          checkResults: [
            {
              type: 'match',
              passed: true,
              message: 'Pattern matched'
            }
          ],
          passed: true
        }
      ];

      // Mock start run
      nock(API_URL)
        .post('/api/eval/run')
        .reply(200, { runId });

      // Mock status polling (first queued, then completed)
      nock(API_URL)
        .get(`/api/eval/status/${runId}`)
        .reply(200, {
          status: 'running',
          results: []
        });

      nock(API_URL)
        .get(`/api/eval/status/${runId}`)
        .reply(200, {
          status: 'completed',
          results: mockResults
        });

      const runner = new VibeCheckRunner({ apiKey: API_KEY });
      const filePath = path.join(__dirname, '../fixtures/valid-eval.yaml');
      const results = await runner.run({ file: filePath });

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
    }, 10000);

    it('should run evaluation with model override', async () => {
      const runId = 'test-run-id';

      nock(API_URL)
        .post('/api/eval/run', (body) => {
          return body.evalSuite.metadata.model === 'custom/model';
        })
        .reply(200, { runId });

      nock(API_URL)
        .get(`/api/eval/status/${runId}`)
        .reply(200, {
          status: 'completed',
          results: []
        });

      const runner = new VibeCheckRunner({ apiKey: API_KEY });
      const filePath = path.join(__dirname, '../fixtures/valid-eval.yaml');
      await runner.run({
        file: filePath,
        model: 'custom/model'
      });

      expect(nock.isDone()).toBe(true);
    }, 10000);

    it('should handle API errors', async () => {
      nock(API_URL)
        .post('/api/eval/run')
        .reply(401, { error: 'Unauthorized' });

      const runner = new VibeCheckRunner({ apiKey: 'invalid-key' });
      const filePath = path.join(__dirname, '../fixtures/valid-eval.yaml');

      await expect(runner.run({ file: filePath })).rejects.toThrow('Authentication failed');
    }, 10000);
  });

  describe('runVibeCheck convenience function', () => {
    it('should run evaluation using convenience function', async () => {
      const runId = 'test-run-id';

      nock(API_URL)
        .post('/api/eval/run')
        .reply(200, { runId });

      nock(API_URL)
        .get(`/api/eval/status/${runId}`)
        .reply(200, {
          status: 'completed',
          results: []
        });

      const filePath = path.join(__dirname, '../fixtures/valid-eval.yaml');
      const results = await runVibeCheck({
        file: filePath,
        apiKey: API_KEY
      });

      expect(results).toBeDefined();
    }, 10000);
  });

  describe('multi-model execution', () => {
    it('should run evaluation on multiple models', async () => {
      const models = ['model1', 'model2'];
      const runIds = ['run-1', 'run-2'];

      models.forEach((model, index) => {
        nock(API_URL)
          .post('/api/eval/run', (body) => {
            return body.evalSuite.metadata.model === model;
          })
          .reply(200, { runId: runIds[index] });

        nock(API_URL)
          .get(`/api/eval/status/${runIds[index]}`)
          .reply(200, {
            status: 'completed',
            results: [
              {
                evalName: `Test ${model}`,
                prompt: 'Test',
                response: 'Response',
                checkResults: [],
                passed: true
              }
            ]
          });
      });

      const runner = new VibeCheckRunner({ apiKey: API_KEY });
      const filePath = path.join(__dirname, '../fixtures/valid-eval.yaml');
      const results = await runner.run({
        file: filePath,
        models
      });

      expect(results).toHaveLength(2);
    }, 10000);
  });
});
