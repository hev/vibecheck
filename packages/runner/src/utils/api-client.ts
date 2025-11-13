import axios, { AxiosError } from 'axios';
import { EvalSuite, RunResponse, StatusResponse, EvalResult } from '../types';

const DEFAULT_API_URL = 'https://vibecheck-api-prod-681369865361.us-central1.run.app';
const DEFAULT_POLL_INTERVAL = 1000; // 1 second

export class VibeCheckApiClient {
  private apiKey: string;
  private apiUrl: string;
  private pollInterval: number;

  constructor(apiKey: string, apiUrl?: string, pollInterval?: number) {
    if (!apiKey) {
      throw new Error('API key is required. Get your API key at https://vibescheck.io');
    }
    this.apiKey = apiKey;
    this.apiUrl = apiUrl || DEFAULT_API_URL;
    this.pollInterval = pollInterval || DEFAULT_POLL_INTERVAL;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey
    };
  }

  /**
   * Starts an evaluation run
   */
  async startRun(evalSuite: EvalSuite, yamlContent?: string): Promise<string> {
    try {
      const response = await axios.post<RunResponse>(
        `${this.apiUrl}/api/eval/run`,
        {
          evalSuite,
          yamlContent
        },
        {
          headers: this.getHeaders()
        }
      );

      if (response.data.error) {
        const errorMsg = typeof response.data.error === 'string'
          ? response.data.error
          : response.data.error.message || JSON.stringify(response.data.error);
        throw new Error(`API Error: ${errorMsg}`);
      }

      return response.data.runId;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Polls for run status until completion
   */
  async waitForCompletion(runId: string): Promise<EvalResult[]> {
    let completed = false;

    while (!completed) {
      try {
        const response = await axios.get<StatusResponse>(
          `${this.apiUrl}/api/eval/status/${runId}`,
          {
            headers: this.getHeaders()
          }
        );

        const { status, results, error } = response.data;

        if (status === 'completed') {
          completed = true;
          return results || [];
        } else if (status === 'failed') {
          const errorMsg = typeof error === 'string'
            ? error
            : error?.message || 'Evaluation failed';
          throw new Error(errorMsg);
        } else if (status === 'partial_failure') {
          completed = true;
          const errorMsg = typeof error === 'string'
            ? error
            : error?.message || 'Some evaluations failed';
          throw new Error(`Partial failure: ${errorMsg}. Results: ${JSON.stringify(results)}`);
        } else if (status === 'timed_out') {
          completed = true;
          throw new Error('Evaluation timed out');
        } else if (status === 'error') {
          const errorMsg = typeof error === 'string'
            ? error
            : error?.message || 'Evaluation error';
          throw new Error(errorMsg);
        }

        // Wait before polling again
        await this.sleep(this.pollInterval);
      } catch (error) {
        throw this.handleError(error);
      }
    }

    return [];
  }

  /**
   * Gets the status of a run without waiting
   */
  async getStatus(runId: string): Promise<StatusResponse> {
    try {
      const response = await axios.get<StatusResponse>(
        `${this.apiUrl}/api/eval/status/${runId}`,
        {
          headers: this.getHeaders()
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;

      // Network errors
      if (!axiosError.response) {
        return new Error(
          'Network error: Unable to connect to vibecheck API. ' +
          'Please check your internet connection or verify the API URL.'
        );
      }

      // HTTP errors
      const status = axiosError.response.status;
      const data = axiosError.response.data;

      if (status === 401 || status === 403) {
        return new Error(
          'Authentication failed: Invalid API key. ' +
          'Get your API key at https://vibescheck.io'
        );
      } else if (status === 402) {
        const errorMsg = data?.error?.message || data?.error || 'Payment required: Your credits are running low';
        return new Error(`${errorMsg}. Visit https://vibescheck.io to add credits`);
      } else if (status === 404) {
        return new Error('Resource not found');
      } else if (status === 500) {
        return new Error('Server error: The vibecheck API encountered an error');
      } else if (data?.error) {
        const errorMsg = typeof data.error === 'string'
          ? data.error
          : data.error.message || JSON.stringify(data.error);
        return new Error(`API Error: ${errorMsg}`);
      }

      return new Error(`HTTP ${status}: ${axiosError.message}`);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }
}
