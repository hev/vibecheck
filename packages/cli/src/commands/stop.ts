import axios from 'axios';
import chalk from 'chalk';
import { getApiUrl } from '../utils/config';
import { getAuthHeaders } from '../utils/command-helpers';

export async function stopRunCommand(runId: string, debug: boolean = false) {
  const spinner = require('ora')(`Stopping run "${runId}"...`).start();

  try {
    const url = `${getApiUrl()}/api/runs/${encodeURIComponent(runId)}/cancel`;
    
    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Request URL: ${url}`));
      spinner.start();
    }

    const response = await axios.post(url, {}, {
      headers: getAuthHeaders()
    });

    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Response status: ${response.status}`));
      console.log(chalk.gray(`[DEBUG] Response data:`), JSON.stringify(response.data, null, 2));
      spinner.start();
    }

    if (response.data.error) {
      spinner.fail(chalk.redBright(`Error: ${response.data.error.message || response.data.error}`));
      process.exit(1);
    }

    spinner.stop();
    console.log(chalk.green(`✨ Run "${runId}" cancelled successfully!`));
    console.log(chalk.gray(`The run has been stopped and marked as cancelled.`));

  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to stop run 🚩'));

    if (error.response) {
      const { status, data } = error.response;
      
      if (debug) {
        console.log(chalk.gray(`[DEBUG] Error response status: ${status}`));
        console.log(chalk.gray(`[DEBUG] Error response data:`), JSON.stringify(data, null, 2));
      }

      switch (status) {
        case 404:
          console.error(chalk.redBright(`Run "${runId}" not found`));
          console.error(chalk.gray('The run may not exist or may not belong to your organization.'));
          break;
        case 409:
          console.error(chalk.redBright(`Run "${runId}" cannot be cancelled`));
          console.error(chalk.gray('Only queued runs can be cancelled. This run may already be completed, running, or cancelled.'));
          break;
        case 403:
          console.error(chalk.redBright('Access denied'));
          console.error(chalk.gray('Admin keys cannot access runs. Use an organization API key instead.'));
          break;
        case 401:
          console.error(chalk.redBright('Authentication failed'));
          console.error(chalk.gray('Invalid or missing API key. Check your VIBECHECK_API_KEY configuration.'));
          break;
        default:
          const errorMsg = data?.error?.message || data?.error || 'Unknown server error';
          console.error(chalk.redBright(`API Error: ${errorMsg}`));
      }
    } else if (error.request) {
      console.error(chalk.redBright('Network error'));
      console.error(chalk.gray('Unable to connect to the vibecheck API. Check your internet connection.'));
    } else {
      console.error(chalk.redBright('Unexpected error'));
      console.error(chalk.gray(error.message));
    }

    process.exit(1);
  }
}

export async function stopAllQueuedRunsCommand(debug: boolean = false) {
  const spinner = require('ora')('Finding queued runs...').start();

  try {
    // First, get all runs with status 'queued'
    const runsUrl = `${getApiUrl()}/api/runs`;
    const runsResponse = await axios.get(runsUrl, {
      headers: getAuthHeaders(),
      params: { status: 'queued', limit: 100 } // Get up to 100 queued runs
    });

    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Runs request URL: ${runsUrl}`));
      console.log(chalk.gray(`[DEBUG] Runs response status: ${runsResponse.status}`));
      console.log(chalk.gray(`[DEBUG] Runs response data:`), JSON.stringify(runsResponse.data, null, 2));
      spinner.start();
    }

    if (runsResponse.data.error) {
      spinner.fail(chalk.redBright(`Error: ${runsResponse.data.error.message || runsResponse.data.error}`));
      process.exit(1);
    }

    const queuedRuns = runsResponse.data.runs || [];
    
    if (queuedRuns.length === 0) {
      spinner.stop();
      console.log(chalk.yellow('No queued runs found to cancel.'));
      return;
    }

    spinner.stop();
    console.log(chalk.blue(`Found ${queuedRuns.length} queued run(s) to cancel:`));
    
    // Display the runs that will be cancelled
    queuedRuns.forEach((run: any) => {
      console.log(chalk.gray(`  - ${run.id} (${run.suite_name || 'Unknown suite'})`));
    });
    
    console.log();

    // Cancel each run
    let successCount = 0;
    let errorCount = 0;

    for (const run of queuedRuns) {
      const runSpinner = require('ora')(`Cancelling run "${run.id}"...`).start();
      
      try {
        const cancelUrl = `${getApiUrl()}/api/runs/${encodeURIComponent(run.id)}/cancel`;
        
        if (debug) {
          runSpinner.stop();
          console.log(chalk.gray(`[DEBUG] Cancel request URL: ${cancelUrl}`));
          runSpinner.start();
        }

        const cancelResponse = await axios.post(cancelUrl, {}, {
          headers: getAuthHeaders()
        });

        if (debug) {
          runSpinner.stop();
          console.log(chalk.gray(`[DEBUG] Cancel response status: ${cancelResponse.status}`));
          console.log(chalk.gray(`[DEBUG] Cancel response data:`), JSON.stringify(cancelResponse.data, null, 2));
          runSpinner.start();
        }

        if (cancelResponse.data.error) {
          runSpinner.fail(chalk.redBright(`Failed to cancel run "${run.id}": ${cancelResponse.data.error.message || cancelResponse.data.error}`));
          errorCount++;
        } else {
          runSpinner.succeed(chalk.green(`Cancelled run "${run.id}"`));
          successCount++;
        }
      } catch (error: any) {
        runSpinner.fail(chalk.redBright(`Failed to cancel run "${run.id}"`));
        
        if (debug) {
          console.log(chalk.gray(`[DEBUG] Error details:`), error.message);
        }
        
        errorCount++;
      }
    }

    console.log();
    if (successCount > 0) {
      console.log(chalk.green(`✨ Successfully cancelled ${successCount} run(s)!`));
    }
    if (errorCount > 0) {
      console.log(chalk.redBright(`🚩 Failed to cancel ${errorCount} run(s).`));
    }

  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to get queued runs 🚩'));

    if (error.response) {
      const { status, data } = error.response;
      
      if (debug) {
        console.log(chalk.gray(`[DEBUG] Error response status: ${status}`));
        console.log(chalk.gray(`[DEBUG] Error response data:`), JSON.stringify(data, null, 2));
      }

      switch (status) {
        case 403:
          console.error(chalk.redBright('Access denied'));
          console.error(chalk.gray('Admin keys cannot access runs. Use an organization API key instead.'));
          break;
        case 401:
          console.error(chalk.redBright('Authentication failed'));
          console.error(chalk.gray('Invalid or missing API key. Check your VIBECHECK_API_KEY configuration.'));
          break;
        default:
          const errorMsg = data?.error?.message || data?.error || 'Unknown server error';
          console.error(chalk.redBright(`API Error: ${errorMsg}`));
      }
    } else if (error.request) {
      console.error(chalk.redBright('Network error'));
      console.error(chalk.gray('Unable to connect to the vibecheck API. Check your internet connection.'));
    } else {
      console.error(chalk.redBright('Unexpected error'));
      console.error(chalk.gray(error.message));
    }

    process.exit(1);
  }
}
