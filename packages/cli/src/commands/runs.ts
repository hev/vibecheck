import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { EvalResult, ConditionalResult } from '../types';
import { displaySummary } from '../utils/display';
import { displayInvitePrompt } from '../utils/auth-error';
import { isNetworkError, displayNetworkError } from '../utils/network-error';
import { getApiUrl } from '../utils/config';

/**
 * Calculate price-performance-latency score
 * Formula: success_percentage / (cost * 1000 + duration_seconds * 0.1)
 * Higher score = better overall performance (cheaper + more accurate + faster)
 * 
 * The latency factor (duration_seconds * 0.1) adds a small penalty for slower runs
 * This ensures faster models get a slight advantage in the score
 */
function calculatePricePerformanceScore(successPercentage: number, totalCost: number | null, durationSeconds: number | null): number | null {
  if (totalCost === null || totalCost === 0) {
    return null; // Cannot calculate without cost data
  }
  
  if (successPercentage < 0 || successPercentage > 100) {
    return null; // Invalid success percentage
  }
  
  // Add latency penalty: duration in seconds * 0.1
  const latencyPenalty = durationSeconds ? durationSeconds * 0.1 : 0;
  const totalPenalty = (totalCost * 1000) + latencyPenalty;
  
  return successPercentage / totalPenalty;
}

function getAuthHeaders() {
  const currentApiKey = process.env.VIBECHECK_API_KEY;
  
  if (!currentApiKey) {
    displayInvitePrompt();
    process.exit(1);
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentApiKey}`
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
  sortBy?: string;
}

// List all runs with pagination
export async function listRunsCommand(options: ListRunsOptions = {}, debug: boolean = false) {
  const { limit = 50, offset = 0, suite, status, successGt, successLt, timeGt, timeLt, sortBy = 'created' } = options;
  const spinner = suite 
    ? ora(`Fetching runs for suite "${suite}"...`).start()
    : ora('Fetching runs...').start();

  try {
    // Use suite-specific endpoint when suite is specified
    const url = suite 
      ? `${getApiUrl()}/api/runs/by-suite/${encodeURIComponent(suite)}`
      : `${getApiUrl()}/api/runs`;

    // Build query params
    const params: any = { limit, offset };
    // Note: Suite filtering uses dedicated endpoint, not query params
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

    // Sort runs based on sortBy parameter
    const sortedRuns = [...runs].sort((a: any, b: any) => {
      switch (sortBy) {
        case 'created':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'success':
          const aSuccess = parseFloat(a.success_percentage) || 0;
          const bSuccess = parseFloat(b.success_percentage) || 0;
          return bSuccess - aSuccess;
        case 'cost':
          const aCost = a.total_cost ? parseFloat(a.total_cost) : 0;
          const bCost = b.total_cost ? parseFloat(b.total_cost) : 0;
          return aCost - bCost; // Lower cost first
        case 'time':
          const aTime = parseFloat(a.duration_seconds) || 0;
          const bTime = parseFloat(b.duration_seconds) || 0;
          return aTime - bTime; // Lower time first
        case 'price-performance':
          // Only calculate scores for completed runs
          const aCompleted = a.status === 'completed';
          const bCompleted = b.status === 'completed';
          
          if (!aCompleted && !bCompleted) return 0; // Both incomplete, maintain order
          if (!aCompleted) return 1; // Put incomplete runs at end
          if (!bCompleted) return -1; // Put incomplete runs at end
          
          // Both completed, calculate and compare scores
          const aScore = calculatePricePerformanceScore(parseFloat(a.success_percentage) || 0, a.total_cost ? parseFloat(a.total_cost) : null, parseFloat(a.duration_seconds) || null);
          const bScore = calculatePricePerformanceScore(parseFloat(b.success_percentage) || 0, b.total_cost ? parseFloat(b.total_cost) : null, parseFloat(b.duration_seconds) || null);
          if (aScore === null && bScore === null) return 0;
          if (aScore === null) return 1; // Put null scores at end
          if (bScore === null) return -1;
          return bScore - aScore; // Higher score first
        default:
          return 0; // No sorting
      }
    });

    if (sortedRuns.length === 0) {
      if (suite) {
        console.log(chalk.yellow(`No runs found for suite "${suite}"`));
        console.log(chalk.gray('Use "vibe get suites" to list available suites'));
      } else {
        console.log(chalk.yellow('No runs found'));
      }
      return;
    }

    // Display sort indicator
    const sortDirection = sortBy === 'created' ? 'descending' : 'ascending';
    console.log(chalk.gray(`Sorted by: ${sortBy} (${sortDirection})`));
    console.log(chalk.bold('\nRuns:\n'));
    console.log(
      chalk.bold('ID'.padEnd(38)) +
      chalk.bold('Suite Name'.padEnd(20)) +
      chalk.bold('Model'.padEnd(35)) +
      chalk.bold('Status'.padEnd(18)) +
      chalk.bold('Pass/Fail'.padEnd(20)) +
      chalk.bold('Time'.padEnd(12)) +
      chalk.bold('Cost'.padEnd(12)) +
      chalk.bold('Score')
    );
    console.log('='.repeat(175));

    sortedRuns.forEach((run: any) => {
      const statusColor = run.status === 'completed' ? chalk.green : run.status === 'failed' ? chalk.redBright : chalk.yellow;

      // Parse fields from API (they come as strings)
      const resultsCount = parseInt(run.results_count, 10) || 0;
      const evalsPassed = parseInt(run.evals_passed, 10) || 0;
      const successPercentage = parseFloat(run.success_percentage) || 0;
      const durationSeconds = parseFloat(run.duration_seconds);
      const totalCost = run.total_cost ? parseFloat(run.total_cost) : null;

      // Use results_count and evals_passed from API response
      const passRateText = resultsCount > 0
        ? `${evalsPassed}/${resultsCount} (${successPercentage.toFixed(0)}%)`
        : 'N/A';

      // Color code based on success percentage (pad BEFORE coloring)
      let passRate;
      if (resultsCount === 0) {
        passRate = chalk.white(passRateText.padEnd(20));
      } else if (successPercentage > 80) {
        passRate = chalk.green(passRateText.padEnd(20));
      } else if (successPercentage >= 50) {
        passRate = chalk.yellow(passRateText.padEnd(20));
      } else {
        passRate = chalk.redBright(passRateText.padEnd(20));
      }

      // Use duration_seconds from API response
      const time = !isNaN(durationSeconds)
        ? `${durationSeconds.toFixed(1)}s`
        : 'N/A';

      // Format cost from API response
      const cost = totalCost !== null
        ? `$${totalCost.toFixed(6)}`
        : 'N/A';

      // Calculate and format Score (price-performance-latency)
      // Only show scores for completed runs to avoid skewing cost comparisons
      let ppScore = null;
      let ppScoreText = 'N/A';
      let ppScoreColor = chalk.gray;
      
      if (run.status === 'completed') {
        ppScore = calculatePricePerformanceScore(successPercentage, totalCost, durationSeconds);
        
        if (ppScore !== null) {
          ppScoreText = ppScore.toFixed(2);
          if (ppScore >= 1.0) {
            ppScoreColor = chalk.green;
          } else if (ppScore >= 0.3) {
            ppScoreColor = chalk.yellow;
          } else {
            ppScoreColor = chalk.redBright;
          }
        }
      }

      // Truncate model name if too long
      const modelName = run.model || 'N/A';
      const truncatedModel = modelName.length > 35
        ? modelName.substring(0, 32) + '...'
        : modelName;

      console.log(
        chalk.cyan(run.id.padEnd(38)) +
        chalk.white(run.suite_name.padEnd(20)) +
        chalk.white(truncatedModel.padEnd(35)) +
        statusColor(run.status.padEnd(18)) +
        passRate +
        chalk.gray(time.padEnd(12)) +
        chalk.gray(cost.padEnd(12)) +
        ppScoreColor(ppScoreText.padEnd(12))
      );
    });

    console.log('');

    // Calculate summary metrics for the filtered runs
    if (sortedRuns.length > 0) {
      const totalSuccessRate = sortedRuns.reduce((sum: number, run: any) => {
        return sum + (parseFloat(run.success_percentage) || 0);
      }, 0);
      const avgSuccessRate = totalSuccessRate / sortedRuns.length;

      const costsWithValues = sortedRuns
        .map((run: any) => run.total_cost ? parseFloat(run.total_cost) : null)
        .filter((cost: number | null) => cost !== null);
      const totalCost = costsWithValues.reduce((sum: number, cost: number) => sum + cost, 0);

      const totalDuration = sortedRuns.reduce((sum: number, run: any) => {
        const duration = parseFloat(run.duration_seconds);
        return sum + (!isNaN(duration) ? duration : 0);
      }, 0);
      const avgDuration = totalDuration / sortedRuns.length;

      console.log(chalk.bold('Summary:'));
      console.log(
        chalk.gray('  Avg Success Rate: ') + chalk.white(`${avgSuccessRate.toFixed(1)}%`) +
        chalk.gray('  │  Total Cost: ') + chalk.white(`$${totalCost.toFixed(6)}`) +
        chalk.gray('  │  Avg Time: ') + chalk.white(`${avgDuration.toFixed(1)}s`)
      );
      console.log('');
    }

    if (pagination) {
      console.log(chalk.gray(`Showing ${offset + 1}-${offset + sortedRuns.length} of ${pagination.total} runs`));
      if (pagination.hasMore) {
        console.log(chalk.gray(`Use --limit and --offset to paginate`));
      }
      console.log('');
    }
  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to list runs'));
    const errorUrl = suite 
      ? `${getApiUrl()}/api/runs/by-suite/${encodeURIComponent(suite)}`
      : `${getApiUrl()}/api/runs`;
    handleError(error, errorUrl);
  }
}

// List runs for a specific suite
export async function listRunsBySuiteCommand(suiteName: string, options: ListRunsOptions = {}) {
  const { limit = 50, offset = 0 } = options;
  const spinner = ora(`Fetching runs for suite "${suiteName}"...`).start();

  try {
    const response = await axios.get(`${getApiUrl()}/api/runs/by-suite/${encodeURIComponent(suiteName)}`, {
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
      } else if (successPercentage > 80) {
        passRate = chalk.green(passRateText.padEnd(20));
      } else if (successPercentage >= 50) {
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
    handleError(error, `${getApiUrl()}/api/runs/by-suite/${encodeURIComponent(suiteName)}`);
  }
}

// Get detailed results for a specific run
export async function getRunCommand(runId: string, debug: boolean = false) {
  const spinner = ora(`Fetching run "${runId}"...`).start();

  try {
    const url = `${getApiUrl()}/api/runs/${runId}`;
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
    handleError(error, `${getApiUrl()}/api/runs/${runId}`);
  }
}

// Error handler
function handleError(error: any, url: string) {
  // Handle network errors first
  if (isNetworkError(error)) {
    displayNetworkError();
    process.exit(1);
  }

  if (error.response?.status === 401 || error.response?.status === 403) {
    displayInvitePrompt();
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
