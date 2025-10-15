import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { EvalResult, ConditionalResult } from '../types';
import { displaySummary } from '../utils/display';

const API_URL = process.env.VIBECHECK_URL || 'http://localhost:3000';
const API_KEY = process.env.VIBECHECK_API_KEY;

function getAuthHeaders() {
  if (!API_KEY) {
    console.error(chalk.redBright('Error: VIBECHECK_API_KEY environment variable is required'));
    console.error(chalk.gray('Get your API key at https://vibescheck.io'));
    process.exit(1);
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };
}

interface ListRunsOptions {
  limit?: number;
  offset?: number;
  suite?: string;
  status?: string;
  successGt?: number;
  successLt?: number;
  timeGt?: number;
  timeLt?: number;
}

// List all runs with pagination
export async function listRunsCommand(options: ListRunsOptions = {}, debug: boolean = false) {
  const { limit = 50, offset = 0, suite, status, successGt, successLt, timeGt, timeLt } = options;
  const spinner = ora('Fetching runs...').start();

  try {
    const url = `${API_URL}/api/runs`;

    // Build query params
    const params: any = { limit, offset };
    if (suite) params.suite = suite;
    if (status) params.status = status;
    if (successGt !== undefined) params.successGt = successGt;
    if (successLt !== undefined) params.successLt = successLt;
    if (timeGt !== undefined) params.timeGt = timeGt;
    if (timeLt !== undefined) params.timeLt = timeLt;

    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Request URL: ${url}`));
      console.log(chalk.gray(`[DEBUG] Request params: ${JSON.stringify(params)}`));
      spinner.start();
    }

    const response = await axios.get(url, {
      headers: getAuthHeaders(),
      params
    });

    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Response status: ${response.status}`));
      console.log(chalk.gray(`[DEBUG] Response data:`), JSON.stringify(response.data, null, 2));
      spinner.start();
    }

    if (response.data.error) {
      spinner.fail(chalk.redBright(`Error: ${response.data.error}`));
      process.exit(1);
    }

    spinner.stop();

    const { runs, pagination } = response.data;

    if (runs.length === 0) {
      console.log(chalk.yellow('No runs found'));
      return;
    }

    console.log(chalk.bold('\nRuns:\n'));
    console.log(
      chalk.bold('ID'.padEnd(38)) +
      chalk.bold('Suite Name'.padEnd(20)) +
      chalk.bold('Model'.padEnd(45)) +
      chalk.bold('Status'.padEnd(18)) +
      chalk.bold('Pass/Fail'.padEnd(20)) +
      chalk.bold('Time')
    );
    console.log('='.repeat(150));

    runs.forEach((run: any) => {
      const statusColor = run.status === 'completed' ? chalk.green : run.status === 'failed' ? chalk.redBright : chalk.yellow;

      // Parse fields from API (they come as strings)
      const resultsCount = parseInt(run.results_count, 10) || 0;
      const evalsPassed = parseInt(run.evals_passed, 10) || 0;
      const successPercentage = parseFloat(run.success_percentage) || 0;
      const durationSeconds = parseFloat(run.duration_seconds);

      // Use results_count and evals_passed from API response
      const passRateText = resultsCount > 0
        ? `${evalsPassed}/${resultsCount} (${successPercentage.toFixed(0)}%)`
        : 'N/A';

      // Color code based on success percentage (pad BEFORE coloring)
      let passRate;
      if (resultsCount === 0) {
        passRate = chalk.white(passRateText.padEnd(20));
      } else if (successPercentage === 100) {
        passRate = chalk.green(passRateText.padEnd(20));
      } else if (successPercentage >= 80) {
        passRate = chalk.yellow(passRateText.padEnd(20));
      } else {
        passRate = chalk.redBright(passRateText.padEnd(20));
      }

      // Use duration_seconds from API response
      const time = !isNaN(durationSeconds)
        ? `${durationSeconds.toFixed(1)}s`
        : 'N/A';

      // Truncate model name if too long
      const modelName = run.model || 'N/A';
      const truncatedModel = modelName.length > 45
        ? modelName.substring(0, 42) + '...'
        : modelName;

      console.log(
        chalk.cyan(run.id.padEnd(38)) +
        chalk.white(run.suite_name.padEnd(20)) +
        chalk.white(truncatedModel.padEnd(45)) +
        statusColor(run.status.padEnd(18)) +
        passRate +
        chalk.gray(time)
      );
    });

    console.log('');

    if (pagination) {
      console.log(chalk.gray(`Showing ${offset + 1}-${offset + runs.length} of ${pagination.total} runs`));
      if (pagination.hasMore) {
        console.log(chalk.gray(`Use --limit and --offset to paginate`));
      }
      console.log('');
    }
  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to list runs'));
    handleError(error, `${API_URL}/api/runs`);
  }
}

// List runs for a specific suite
export async function listRunsBySuiteCommand(suiteName: string, options: ListRunsOptions = {}) {
  const { limit = 50, offset = 0 } = options;
  const spinner = ora(`Fetching runs for suite "${suiteName}"...`).start();

  try {
    const response = await axios.get(`${API_URL}/api/runs/by-suite/${encodeURIComponent(suiteName)}`, {
      headers: getAuthHeaders(),
      params: { limit, offset }
    });

    if (response.data.error) {
      spinner.fail(chalk.redBright(`Error: ${response.data.error}`));
      process.exit(1);
    }

    spinner.stop();

    const { runs, pagination } = response.data;

    if (runs.length === 0) {
      console.log(chalk.yellow(`No runs found for suite "${suiteName}"`));
      return;
    }

    console.log(chalk.bold(`\nRuns for suite "${suiteName}":\n`));
    console.log(
      chalk.bold('ID'.padEnd(38)) +
      chalk.bold('Status'.padEnd(12)) +
      chalk.bold('Pass/Fail'.padEnd(20)) +
      chalk.bold('Time'.padEnd(10)) +
      chalk.bold('Started At')
    );
    console.log('='.repeat(100));

    runs.forEach((run: any) => {
      const statusColor = run.status === 'completed' ? chalk.green : run.status === 'failed' ? chalk.redBright : chalk.yellow;

      // Parse fields from API (they come as strings)
      const resultsCount = parseInt(run.results_count, 10) || 0;
      const evalsPassed = parseInt(run.evals_passed, 10) || 0;
      const successPercentage = parseFloat(run.success_percentage) || 0;
      const durationSeconds = parseFloat(run.duration_seconds);

      // Use results_count and evals_passed from API response
      const passRateText = resultsCount > 0
        ? `${evalsPassed}/${resultsCount}`
        : 'N/A';

      // Color code based on success percentage (pad BEFORE coloring)
      let passRate;
      if (resultsCount === 0) {
        passRate = chalk.white(passRateText.padEnd(20));
      } else if (successPercentage === 100) {
        passRate = chalk.green(passRateText.padEnd(20));
      } else if (successPercentage >= 80) {
        passRate = chalk.yellow(passRateText.padEnd(20));
      } else {
        passRate = chalk.redBright(passRateText.padEnd(20));
      }

      // Use duration_seconds from API response
      const time = !isNaN(durationSeconds)
        ? `${durationSeconds.toFixed(1)}s`
        : 'N/A';

      // Use created_at from API response
      const startedAt = run.created_at ? new Date(run.created_at).toLocaleString() : 'N/A';

      console.log(
        chalk.cyan(run.id.padEnd(38)) +
        statusColor(run.status.padEnd(12)) +
        passRate +
        chalk.gray(time.padEnd(10)) +
        chalk.gray(startedAt)
      );
    });

    console.log('');

    if (pagination) {
      console.log(chalk.gray(`Showing ${offset + 1}-${offset + runs.length} of ${pagination.total} runs`));
      if (pagination.hasMore) {
        console.log(chalk.gray(`Use --limit and --offset to paginate`));
      }
      console.log('');
    }
  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to list runs'));
    handleError(error, `${API_URL}/api/runs/by-suite/${encodeURIComponent(suiteName)}`);
  }
}

// Get detailed results for a specific run
export async function getRunCommand(runId: string, debug: boolean = false) {
  const spinner = ora(`Fetching run "${runId}"...`).start();

  try {
    const url = `${API_URL}/api/runs/${runId}`;
    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Request URL: ${url}`));
      spinner.start();
    }

    const response = await axios.get(url, {
      headers: getAuthHeaders()
    });

    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Response status: ${response.status}`));
      console.log(chalk.gray(`[DEBUG] Response data:`), JSON.stringify(response.data, null, 2));
      spinner.start();
    }

    if (response.data.error) {
      spinner.fail(chalk.redBright(`Error: ${response.data.error}`));
      process.exit(1);
    }

    spinner.stop();

    const { run } = response.data;

    // Parse fields from API (they come as strings)
    const durationSeconds = parseFloat(run.duration_seconds);
    const resultsCount = parseInt(run.results_count, 10);
    const evalsPassed = parseInt(run.evals_passed, 10);
    const successPercentage = parseFloat(run.success_percentage);

    console.log(chalk.bold('\n=== Run Details ===\n'));
    console.log(chalk.cyan('ID:           ') + run.id);
    console.log(chalk.cyan('Suite Name:   ') + run.suite_name);
    console.log(chalk.cyan('Model:        ') + run.model);
    console.log(chalk.cyan('Status:       ') + (run.status === 'completed' ? chalk.green(run.status) : chalk.yellow(run.status)));
    console.log(chalk.cyan('Started:      ') + (run.created_at ? new Date(run.created_at).toLocaleString() : 'N/A'));
    if (run.completed_at) {
      console.log(chalk.cyan('Completed:    ') + new Date(run.completed_at).toLocaleString());
    }
    if (!isNaN(durationSeconds)) {
      console.log(chalk.cyan('Duration:     ') + `${durationSeconds.toFixed(2)}s`);
    }
    if (!isNaN(resultsCount)) {
      const passRate = !isNaN(evalsPassed) ? `${evalsPassed}/${resultsCount}` : 'N/A';
      const percentage = !isNaN(successPercentage) ? `${successPercentage.toFixed(1)}%` : 'N/A';
      console.log(chalk.cyan('Results:      ') + `${passRate} passed (${percentage})`);
    }
    console.log('');

    if (run.results && run.results.length > 0) {
      console.log(chalk.bold('=== Evaluation Results ===\n'));

      const truncate = (text: string, max: number) => {
        if (!text) return '';
        return text.length > max ? text.substring(0, max - 3) + '...' : text;
      };

      const formatConditionalDetails = (cond: any, response: string): string | { text: string; highlight: string } => {
        const message = cond.message || '';

        if (cond.type === 'string_contains') {
          const match = message.match(/contains? ['"](.+?)['"]/i) || message.match(/found ['"](.+?)['"]/i);
          if (match) {
            const searchString = match[1];
            const index = response.toLowerCase().indexOf(searchString.toLowerCase());
            if (index !== -1) {
              const start = Math.max(0, index - 10);
              const end = Math.min(response.length, index + searchString.length + 10);
              const snippet = response.substring(start, end);
              const highlightText = response.substring(index, index + searchString.length);
              return { text: truncate(snippet, 50), highlight: highlightText };
            }
            return truncate(searchString, 50);
          }
          return truncate(message, 60);
        }

        if (cond.type === 'semantic_similarity') {
          const simMatch = message.match(/similarity[:\s]+(\d+(?:\.\d+)?)/i);
          if (simMatch) {
            const similarity = parseFloat(simMatch[1]);
            const simPercent = similarity <= 1 ? (similarity * 100).toFixed(0) : similarity.toFixed(0);
            return `${simPercent}%`;
          }
          return truncate(message, 60);
        }

        if (cond.type === 'llm_judge') {
          return cond.passed ? 'PASS' : truncate(message, 80);
        }

        if (cond.type === 'token_length') {
          const countMatch = message.match(/(\d+)\s+tokens?/i);
          const minMatch = message.match(/min[:\s]+(\d+)/i);
          const maxMatch = message.match(/max[:\s]+(\d+)/i);

          if (countMatch) {
            const count = countMatch[1];
            const min = minMatch ? minMatch[1] : null;
            const max = maxMatch ? maxMatch[1] : null;

            if (min && max) {
              return `Token count ${count} (min: ${min}, max: ${max})`;
            } else if (min) {
              return `Token count ${count} (min: ${min})`;
            } else if (max) {
              return `Token count ${count} (max: ${max})`;
            }
            return `Token count ${count}`;
          }
          return truncate(message, 60);
        }

        return truncate(message, 60);
      };

      run.results.forEach((result: any) => {
        const displayName = result.eval_name || truncate(result.prompt || '', 60);
        console.log(chalk.bold(displayName + ':'));
        console.log(chalk.blue('Prompt: ') + (result.prompt || ''));
        console.log(chalk.gray('Response: ' + (result.response || '')));

        if (Array.isArray(result.check_results) && result.check_results.length > 0) {
          result.check_results.forEach((cond: any) => {
            const status = cond.passed ? chalk.green('✅ PASS') : chalk.redBright('🚩 FAIL');
            const details = formatConditionalDetails(cond, result.response || '');

            if (cond.type === 'llm_judge') {
              console.log(`  ${status} ${(cond.type || '').padEnd(25)}`);
              if (typeof details === 'string') {
                console.log(`      ${chalk.gray(details)}`);
              }
            } else if (cond.type === 'string_contains') {
              if (typeof details === 'object' && 'text' in details) {
                const { text } = details;
                console.log(`  ${status} ${(cond.type || '').padEnd(25)} ${chalk.gray(text)}`);
              } else {
                console.log(`  ${status} ${(cond.type || '').padEnd(25)} ${chalk.gray(details as string)}`);
              }
            } else if (cond.type === 'semantic_similarity') {
              const coloredDetails = cond.passed ? chalk.green(details as string) : chalk.redBright(details as string);
              console.log(`  ${status} ${(cond.type || '').padEnd(25)} ${coloredDetails}`);
            } else {
              const coloredDetails = cond.passed ? chalk.green(details as string) : chalk.redBright(details as string);
              console.log(`  ${status} ${(cond.type || '').padEnd(25)} ${coloredDetails}`);
            }
          });
        }

        const overallStatus = result.passed ? chalk.green('✅ PASS') : chalk.redBright('🚩 FAIL');
        console.log(`  Overall: ${overallStatus}`);
        console.log('');
      });

      // Transform API results to EvalResult format for summary display
      const evalResults: EvalResult[] = run.results.map((result: any) => ({
        evalName: (result.eval_name || truncate(result.prompt || '', 60)) as string,
        prompt: result.prompt || '',
        response: result.response || '',
        checkResults: (result.check_results || []).map((cond: any) => ({
          type: cond.type,
          passed: cond.passed,
          message: cond.message || ''
        })),
        passed: result.passed,
        executionTimeMs: undefined
      }));

      // Display summary
      const totalTimeMs = !isNaN(durationSeconds) ? durationSeconds * 1000 : undefined;
      await displaySummary(evalResults, totalTimeMs);
    }
  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to get run'));
    handleError(error, `${API_URL}/api/runs/${runId}`);
  }
}

// Get logs for a specific run
export async function getRunLogsCommand(runId: string, debug: boolean = false) {
  const spinner = ora(`Fetching logs for run "${runId}"...`).start();

  try {
    const url = `${API_URL}/api/runs/${runId}/logs`;
    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Request URL: ${url}`));
      spinner.start();
    }

    const response = await axios.get(url, {
      headers: getAuthHeaders()
    });

    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Response status: ${response.status}`));
      console.log(chalk.gray(`[DEBUG] Response data:`), JSON.stringify(response.data, null, 2));
      spinner.start();
    }

    if (response.data.error) {
      spinner.fail(chalk.redBright(`Error: ${response.data.error}`));
      process.exit(1);
    }

    spinner.stop();

    const { logs } = response.data;

    if (!logs || logs.trim().length === 0) {
      console.log(chalk.yellow(`No logs found for run "${runId}"`));
      return;
    }

    console.log(chalk.bold(`\nLogs for run "${runId}":\n`));

    // Split logs by newline and display
    const logLines = logs.split('\n').filter((line: string) => line.trim().length > 0);

    logLines.forEach((line: string) => {
      // Try to detect log level from content
      if (line.toLowerCase().includes('error')) {
        console.log(chalk.redBright(line));
      } else if (line.toLowerCase().includes('warn')) {
        console.log(chalk.yellow(line));
      } else {
        console.log(chalk.gray(line));
      }
    });

    console.log('');
  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to get logs'));
    handleError(error, `${API_URL}/api/runs/${runId}/logs`);
  }
}

// Error handler
function handleError(error: any, url: string) {
  if (error.response?.status === 401) {
    console.error(chalk.redBright('\nUnauthorized: Invalid or missing API key'));
    console.error(chalk.gray('Get your API key at https://vibescheck.io'));
    process.exit(1);
  } else if (error.response?.status === 403) {
    const truncatedKey = API_KEY ? `${API_KEY.substring(0, 8)}...` : 'not set';
    console.error(chalk.redBright('\n🔒 Forbidden: Access denied'));
    console.error(chalk.gray(`URL: ${url}`));
    console.error(chalk.gray(`API Key: ${truncatedKey}`));
    console.error(chalk.gray('Verify your API key at https://vibescheck.io'));
    process.exit(1);
  } else if (error.response?.status === 404) {
    console.error(chalk.redBright('\nNot Found: The requested resource does not exist'));
    process.exit(1);
  } else if (error.response?.status === 500) {
    console.error(chalk.redBright('\nServer error: The VibeCheck API encountered an error'));
    process.exit(1);
  } else if (error.response?.data?.error) {
    console.error(chalk.redBright(`\nAPI Error: ${error.response.data.error}`));
    process.exit(1);
  } else {
    console.error(chalk.redBright(`\n${error.message}`));
    process.exit(1);
  }
}
