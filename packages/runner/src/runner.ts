import { VibeCheckApiClient } from './utils/api-client';
import { YamlLoader } from './utils/yaml-loader';
import { getApiKey, getApiUrl } from './utils/config';
import { EvalSuite, EvalResult, RunOptions, RunnerConfig } from './types';
import { AuthenticationError } from './errors';

export class VibeCheckRunner {
  private apiClient: VibeCheckApiClient;

  constructor(config?: RunnerConfig) {
    // Get API key from config or environment
    const apiKey = config?.apiKey || getApiKey();
    if (!apiKey) {
      throw new AuthenticationError(
        'API key is required. Provide it via constructor, VIBECHECK_API_KEY environment variable, ' +
        'or ~/.vibecheck/.env file. Get your API key at https://vibescheck.io'
      );
    }

    // Get API URL from config or environment
    const apiUrl = config?.apiUrl || getApiUrl() || undefined;

    this.apiClient = new VibeCheckApiClient(apiKey, apiUrl);
  }

  /**
   * Run a vibe check evaluation
   */
  async run(options: RunOptions): Promise<EvalResult[]> {
    let evalSuite: EvalSuite;
    let yamlContent: string | undefined;

    // Load suite from file or use provided suite
    if (options.file) {
      const loaded = YamlLoader.loadFile(options.file);
      evalSuite = loaded.suite;
      yamlContent = loaded.content;
    } else if (options.suite) {
      evalSuite = options.suite;
    } else {
      throw new Error('Either file or suite option is required');
    }

    // Handle model override
    if (options.model) {
      evalSuite.metadata.model = options.model;
    }

    // Handle multi-model execution
    if (options.models && options.models.length > 0) {
      return this.runMultiModel(evalSuite, options.models, yamlContent);
    }

    // Single model execution
    return this.runSingle(evalSuite, yamlContent);
  }

  /**
   * Run evaluation on a single model
   */
  private async runSingle(evalSuite: EvalSuite, yamlContent?: string): Promise<EvalResult[]> {
    // Start the run
    const runId = await this.apiClient.startRun(evalSuite, yamlContent);

    // Wait for completion and return results
    return this.apiClient.waitForCompletion(runId);
  }

  /**
   * Run evaluation on multiple models in parallel
   */
  private async runMultiModel(
    evalSuite: EvalSuite,
    models: string[],
    yamlContent?: string
  ): Promise<EvalResult[]> {
    // Create promises for all model runs
    const promises = models.map(async (model) => {
      const modelSuite = {
        ...evalSuite,
        metadata: {
          ...evalSuite.metadata,
          model
        }
      };

      return this.runSingle(modelSuite, yamlContent);
    });

    // Wait for all runs to complete
    const results = await Promise.all(promises);

    // Flatten results from all models
    return results.flat();
  }

  /**
   * Start a run and return the run ID without waiting
   */
  async startRun(options: RunOptions): Promise<string> {
    let evalSuite: EvalSuite;
    let yamlContent: string | undefined;

    // Load suite from file or use provided suite
    if (options.file) {
      const loaded = YamlLoader.loadFile(options.file);
      evalSuite = loaded.suite;
      yamlContent = loaded.content;
    } else if (options.suite) {
      evalSuite = options.suite;
    } else {
      throw new Error('Either file or suite option is required');
    }

    // Handle model override
    if (options.model) {
      evalSuite.metadata.model = options.model;
    }

    // Start the run
    return this.apiClient.startRun(evalSuite, yamlContent);
  }

  /**
   * Get the status of a run
   */
  async getStatus(runId: string) {
    return this.apiClient.getStatus(runId);
  }

  /**
   * Wait for a run to complete
   */
  async waitForCompletion(runId: string): Promise<EvalResult[]> {
    return this.apiClient.waitForCompletion(runId);
  }
}
