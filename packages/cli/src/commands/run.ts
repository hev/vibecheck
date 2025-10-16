import * as fs from 'fs';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { EvalSuiteSchema, EvalResult, ConditionalResult } from '../types';
import { runInteractiveCommand } from './interactive-run';
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
    'X-API-KEY': API_KEY
  };
}

interface RunOptions {
  file?: string;
  debug?: boolean;
  interactive?: boolean;
  outputDir?: string;
}

export async function runInteractiveMode(options: RunOptions) {
  return runInteractiveCommand(options);
}

export async function runCommand(options: RunOptions) {
  const { file, debug } = options;

  if (!file) {
    console.error(chalk.redBright('Error: --file option is required'));
    process.exit(1);
  }

  const spinner = ora('Reading evaluation file...').start();

  try {
    // Read YAML file
    if (!fs.existsSync(file)) {
      spinner.fail(chalk.redBright(`File not found: ${file}`));
      process.exit(1);
    }

    const fileContent = fs.readFileSync(file, 'utf8');
    const data = yaml.load(fileContent);

    // Validate YAML structure
    const parseResult = EvalSuiteSchema.safeParse(data);

    if (!parseResult.success) {
      spinner.fail(chalk.redBright('Invalid YAML format 🚩'));
      console.error(chalk.redBright('\nValidation errors:'));
      parseResult.error.errors.forEach(err => {
        console.error(chalk.redBright(`  - ${err.path.join('.')}: ${err.message}`));
      });
      process.exit(1);
    }

    const evalSuite = parseResult.data;
    spinner.succeed(chalk.green('Evaluation file loaded successfully ✨'));

    const requestPayload = {
      evalSuite,
      yamlContent: fileContent
    };

    if (debug) {
      const headers = getAuthHeaders();
      const debugHeaders = { ...headers };
      if (debugHeaders['X-API-KEY']) {
        debugHeaders['X-API-KEY'] = `${debugHeaders['X-API-KEY'].substring(0, 10)}...`;
      }
      console.log(chalk.cyan('\n[DEBUG] Request to:'), `${API_URL}/api/eval/run`);
      console.log(chalk.cyan('[DEBUG] Headers:'), JSON.stringify(debugHeaders, null, 2));
      console.log(chalk.cyan('[DEBUG] Request payload:'), JSON.stringify(requestPayload, null, 2));
      console.log();
    }

    const response = await axios.post(`${API_URL}/api/eval/run`, requestPayload, {
      headers: getAuthHeaders()
    });

    if (debug) {
      console.log(chalk.cyan('[DEBUG] Response status:'), response.status);
      console.log(chalk.cyan('[DEBUG] Response data:'), JSON.stringify(response.data, null, 2));
      console.log();
    }

    if (response.data.error) {
      const errorMsg = typeof response.data.error === 'string'
        ? response.data.error
        : response.data.error.message || JSON.stringify(response.data.error);
      console.error(chalk.redBright(`API Error 🚩: ${errorMsg}`));
      process.exit(1);
    }

    const runId = response.data.runId;
    console.log(chalk.blue(`Checking vibes... Run ID: ${runId}\n`));

    // Stream results using EventSource or polling
    await streamResults(runId, debug);

  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to check vibes 🚩'));

    // Handle specific HTTP error codes
    if (error.response?.status === 401) {
      console.error(chalk.redBright('\nUnauthorized: Invalid or missing API key'));
      console.error(chalk.gray('Get your API key at https://vibescheck.io'));
      process.exit(1);
    } else if (error.response?.status === 402) {
      const errorMsg = error.response.data?.error?.message ||
                       error.response.data?.error ||
                       'Payment required: Your credits are running low';
      console.error(chalk.redBright(`\n${errorMsg}`));
      console.error(chalk.gray('Visit https://vibescheck.io to add credits'));
      process.exit(1);
    } else if (error.response?.status === 403) {
      const truncatedKey = API_KEY ? `${API_KEY.substring(0, 8)}...` : 'not set';
      console.error(chalk.redBright('\n🔒 Forbidden: Access denied'));
      console.error(chalk.gray(`URL: ${API_URL}/api/eval/run`));
      console.error(chalk.gray(`API Key: ${truncatedKey}`));
      console.error(chalk.gray('Verify your API key at https://vibescheck.io'));
      process.exit(1);
    } else if (error.response?.status === 500) {
      console.error(chalk.redBright('\nServer error: The VibeCheck API encountered an error'));
      process.exit(1);
    } else if (error.response?.data?.error) {
      const errorMsg = typeof error.response.data.error === 'string'
        ? error.response.data.error
        : error.response.data.error.message || JSON.stringify(error.response.data.error);
      console.error(chalk.redBright(`\nAPI Error: ${errorMsg}`));
      process.exit(1);
    } else {
      console.error(chalk.redBright(`\n${error.message}`));
      process.exit(1);
    }
  }
}

async function streamResults(runId: string, debug?: boolean) {
  const pollInterval = 1000; // 1 second
  let completed = false;
  let lastDisplayedCount = 0;
  let headerDisplayed = false;
  let totalTimeMs: number | undefined;

  while (!completed) {
    try {
      const response = await axios.get(`${API_URL}/api/eval/status/${runId}`, {
        headers: getAuthHeaders()
      });

      if (debug) {
        console.log(chalk.cyan('[DEBUG] Poll response:'), JSON.stringify(response.data, null, 2));
        console.log();
      }

      const { status, results, isUpdate, suiteName, model, systemPrompt, totalTimeMs: totalTime, error: statusError } = response.data;
      if (totalTime) {
        totalTimeMs = totalTime;
      }

      // Display header once when we get the data
      if (!headerDisplayed && suiteName) {
        console.log();
        if (isUpdate) {
          console.log(chalk.yellow(`Updating eval suite: ${suiteName}`));
        } else {
          console.log(chalk.green(`Saving new eval suite: ${suiteName}`));
        }
        console.log();
        console.log(chalk.bold.cyan(`✨ Checking vibes for: ${suiteName}`));
        console.log(chalk.bold.cyan(`Model: ${model}`));
        console.log(chalk.bold.cyan(`System prompt: ${systemPrompt}`));
        console.log();
        headerDisplayed = true;
      }

      if (status === 'running' && results && results.length > lastDisplayedCount) {
        displayResults(results.slice(lastDisplayedCount));
        lastDisplayedCount = results.length;
      } else if (status === 'completed') {
        if (results.length > lastDisplayedCount) {
          displayResults(results.slice(lastDisplayedCount));
        }
        completed = true;
        await displaySummary(results, totalTimeMs);
      } else if (status === 'failed') {
        const errorMsg = statusError?.message || statusError || 'All evaluations failed due to execution errors';
        console.error(chalk.redBright(`\n🚩 ${errorMsg}`));
        completed = true;
        process.exit(1);
      } else if (status === 'partial_failure') {
        if (results.length > lastDisplayedCount) {
          displayResults(results.slice(lastDisplayedCount));
        }
        completed = true;
        console.log(chalk.yellow('\n⚠️  Warning: Some evaluations failed to execute'));
        if (statusError?.message || statusError) {
          const errorMsg = statusError?.message || statusError;
          console.log(chalk.yellow(`   ${errorMsg}`));
        }
        await displaySummary(results, totalTimeMs);
        process.exit(1);
      } else if (status === 'timed_out') {
        if (results.length > lastDisplayedCount) {
          displayResults(results.slice(lastDisplayedCount));
        }
        completed = true;
        console.log(chalk.yellow('\n⏱️  Evaluation suite timed out'));
        if (statusError?.message || statusError) {
          const errorMsg = statusError?.message || statusError;
          console.log(chalk.yellow(`   ${errorMsg}`));
        }
        await displaySummary(results, totalTimeMs);
        process.exit(1);
      } else if (status === 'error') {
        const errorMsg = statusError?.message || statusError || 'Vibe check failed';
        console.error(chalk.redBright(`\n🚩 ${errorMsg}`));
        completed = true;
        process.exit(1);
      }

      if (!completed) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    } catch (error: any) {
      // Handle specific HTTP error codes
      if (error.response?.status === 401) {
        console.error(chalk.redBright('\nUnauthorized: Invalid or missing API key'));
        console.error(chalk.gray('Get your API key at https://vibescheck.io'));
        process.exit(1);
      } else if (error.response?.status === 402) {
        const errorMsg = error.response.data?.error?.message ||
                         error.response.data?.error ||
                         'Payment required: Your credits are running low';
        console.error(chalk.redBright(`\n${errorMsg}`));
        console.error(chalk.gray('Visit https://vibescheck.io to add credits'));
        process.exit(1);
      } else if (error.response?.status === 403) {
        const truncatedKey = API_KEY ? `${API_KEY.substring(0, 8)}...` : 'not set';
        console.error(chalk.redBright('\n🔒 Forbidden: Access denied'));
        console.error(chalk.gray(`URL: ${API_URL}/api/eval/status/${runId}`));
        console.error(chalk.gray(`API Key: ${truncatedKey}`));
        console.error(chalk.gray('Verify your API key at https://vibescheck.io'));
        process.exit(1);
      } else if (error.response?.status === 500) {
        console.error(chalk.redBright('\nServer error: The VibeCheck API encountered an error'));
        process.exit(1);
      } else if (error.response?.data?.error) {
        const errorMsg = typeof error.response.data.error === 'string'
          ? error.response.data.error
          : error.response.data.error.message || JSON.stringify(error.response.data.error);
        console.error(chalk.redBright(`\n${errorMsg}`));
        process.exit(1);
      } else {
        console.error(chalk.redBright(`Error polling results: ${error.message}`));
        process.exit(1);
      }
    }
  }
}

function truncatePrompt(prompt: string, maxLength: number = 100): string {
  if (prompt.length <= maxLength) {
    return prompt;
  }
  return prompt.substring(0, maxLength - 3) + '...';
}

function displayResults(results: EvalResult[]) {
  results.forEach((result) => {
    const displayName = truncatePrompt(result.prompt);
    console.log(chalk.bold(`\n${displayName}:`));
    console.log(chalk.blue(`Prompt: ${result.prompt}`));
    console.log(chalk.gray(`Response: ${result.response}`));

    result.checkResults.forEach((cond: ConditionalResult) => {
      const status = cond.passed ? chalk.green('✅ PASS') : chalk.redBright('🚩 FAIL');
      const details = formatConditionalDetails(cond, result.response);

      // Apply different coloring based on conditional type
      if (cond.type === 'llm_judge') {
        // Show llm_judge details on the line below in gray
        console.log(`  ${status} ${cond.type.padEnd(25)}`);
        if (typeof details === 'string') {
          console.log(`      ${chalk.gray(details)}`);
        }
      } else if (cond.type === 'string_contains') {
        // Handle string_contains with snippet in gray (no highlighting)
        if (typeof details === 'object' && 'text' in details) {
          const { text } = details;
          console.log(`  ${status} ${cond.type.padEnd(25)} ${chalk.gray(text)}`);
        } else {
          console.log(`  ${status} ${cond.type.padEnd(25)} ${chalk.gray(details as string)}`);
        }
      } else if (cond.type === 'semantic_similarity') {
        // Green for passed, red only for failed
        const coloredDetails = cond.passed ? chalk.green(details as string) : chalk.redBright(details as string);
        console.log(`  ${status} ${cond.type.padEnd(25)} ${coloredDetails}`);
      } else {
        // Default: use pass/fail colors
        const coloredDetails = cond.passed ? chalk.green(details as string) : chalk.redBright(details as string);
        console.log(`  ${status} ${cond.type.padEnd(25)} ${coloredDetails}`);
      }
    });

    const overallStatus = result.passed ? chalk.green('✅ PASS') : chalk.redBright('🚩 FAIL');
    console.log(`  Overall: ${overallStatus}`);
  });
}

function formatConditionalDetails(cond: ConditionalResult, response: string): string | { text: string; highlight: string } {
  const message = cond.message || '';

  // Parse the message to extract details
  if (cond.type === 'string_contains') {
    // Extract the string that was found (or not found)
    const match = message.match(/contains? ['"](.+?)['"]/i) || message.match(/found ['"](.+?)['"]/i);
    if (match) {
      const searchString = match[1];
      // Find the search string in the response to get context
      const index = response.toLowerCase().indexOf(searchString.toLowerCase());
      if (index !== -1) {
        // Get surrounding context
        const start = Math.max(0, index - 10);
        const end = Math.min(response.length, index + searchString.length + 10);
        const snippet = response.substring(start, end);
        const highlightText = response.substring(index, index + searchString.length);
        return { text: truncateText(snippet, 50), highlight: highlightText };
      }
      return truncateText(searchString, 50);
    }
    return truncateText(message, 60);
  }

  if (cond.type === 'semantic_similarity') {
    // Extract similarity percentage and threshold
    const simMatch = message.match(/similarity[:\s]+(\d+(?:\.\d+)?)/i);

    if (simMatch) {
      const similarity = parseFloat(simMatch[1]);
      // Convert to percentage if needed (values between 0-1)
      const simPercent = similarity <= 1 ? (similarity * 100).toFixed(0) : similarity.toFixed(0);
      return `${simPercent}%`;
    }
    return truncateText(message, 60);
  }

  if (cond.type === 'llm_judge') {
    // Just show PASS or the reason - the message already contains it
    return cond.passed ? 'PASS' : truncateText(message, 80);
  }

  if (cond.type === 'token_length') {
    // Extract token count and min/max
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
    return truncateText(message, 60);
  }

  return truncateText(message, 60);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

