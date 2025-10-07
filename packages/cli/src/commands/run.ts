import * as fs from 'fs';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { EvalSuiteSchema, EvalResult, ConditionalResult } from '@evalit/shared';

const API_URL = process.env.EVALIT_API_URL || 'http://localhost:3000';

interface RunOptions {
  file?: string;
}

export async function runCommand(options: RunOptions) {
  const { file } = options;

  if (!file) {
    console.error(chalk.red('Error: --file option is required'));
    process.exit(1);
  }

  const spinner = ora('Reading evaluation file...').start();

  try {
    // Read YAML file
    if (!fs.existsSync(file)) {
      spinner.fail(chalk.red(`File not found: ${file}`));
      process.exit(1);
    }

    const fileContent = fs.readFileSync(file, 'utf8');
    const data = yaml.load(fileContent);

    // Validate YAML structure
    const parseResult = EvalSuiteSchema.safeParse(data);

    if (!parseResult.success) {
      spinner.fail(chalk.red('Invalid YAML format 🚩'));
      console.error(chalk.red('\nValidation errors:'));
      parseResult.error.errors.forEach(err => {
        console.error(chalk.red(`  - ${err.path.join('.')}: ${err.message}`));
      });
      process.exit(1);
    }

    const evalSuite = parseResult.data;
    spinner.succeed(chalk.green('Evaluation file loaded successfully ✨'));

    const response = await axios.post(`${API_URL}/api/eval/run`, {
      evalSuite,
      yamlContent: fileContent
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data.error) {
      console.error(chalk.red(`API Error 🚩: ${response.data.error}`));
      process.exit(1);
    }

    const runId = response.data.runId;
    console.log(chalk.blue(`Checking vibes... Run ID: ${runId}\n`));

    // Stream results using EventSource or polling
    await streamResults(runId);

  } catch (error: any) {
    spinner.fail(chalk.red('Failed to check vibes 🚩'));
    if (error.response?.data?.error) {
      console.error(chalk.red(`\nAPI Error: ${error.response.data.error}`));
    } else {
      console.error(chalk.red(`\n${error.message}`));
    }
    process.exit(1);
  }
}

async function streamResults(runId: string) {
  const pollInterval = 1000; // 1 second
  let completed = false;
  let lastDisplayedCount = 0;
  let headerDisplayed = false;
  let totalTimeMs: number | undefined;
  let totalCost: { cogs: number; retail: number } | undefined;

  while (!completed) {
    try {
      const response = await axios.get(`${API_URL}/api/eval/status/${runId}`);
      const { status, results, isUpdate, suiteName, model, systemPrompt, totalTimeMs: totalTime, totalCost: cost } = response.data;
      if (totalTime) {
        totalTimeMs = totalTime;
      }
      if (cost) {
        totalCost = cost;
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
        displaySummary(results, totalTimeMs, totalCost);
      } else if (status === 'error') {
        console.error(chalk.red('\n🚩 Vibe check failed'));
        completed = true;
        process.exit(1);
      }

      if (!completed) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    } catch (error: any) {
      console.error(chalk.red(`Error polling results: ${error.message}`));
      process.exit(1);
    }
  }
}

function displayResults(results: EvalResult[]) {
  results.forEach((result) => {
    console.log(chalk.bold(`\n${result.evalName}:`));
    console.log(chalk.blue(`Prompt: ${result.prompt}`));
    console.log(chalk.gray(`Response: ${result.response}`));

    result.conditionalResults.forEach((cond: ConditionalResult) => {
      const status = cond.passed ? chalk.green('✅ white flag') : chalk.red('🚩 red flag');
      console.log(`  ${status} ${cond.type}`);
    });

    const overallStatus = result.passed ? chalk.green('✅ White flag') : chalk.red('🚩 Red flag');
    console.log(`  Overall: ${overallStatus}`);
  });
}

function displaySummary(results: EvalResult[], totalTimeMs?: number, totalCost?: { cogs: number; retail: number }) {
  console.log();
  console.log(chalk.bold('─'.repeat(80)));
  console.log(chalk.bold('✨ VIBE CHECK SUMMARY ✨'));
  console.log(chalk.bold('─'.repeat(80)));
  console.log();

  // Find the longest eval name for padding
  const maxNameLength = Math.max(...results.map(r => r.evalName.length), 20);

  // Display each eval with visual bar chart
  results.forEach((result) => {
    const paddedName = result.evalName.padEnd(maxNameLength);

    // Calculate pass/fail counts for conditionals - one character per conditional
    const passedConditionals = result.conditionalResults.filter(c => c.passed).length;
    const failedConditionals = result.conditionalResults.filter(c => !c.passed).length;

    // Create visual bar - one + or - per conditional
    const failBar = '-'.repeat(failedConditionals);
    const passBar = '+'.repeat(passedConditionals);

    // Format time
    const timeStr = result.executionTimeMs
      ? `in ${(result.executionTimeMs / 1000).toFixed(1)}s`
      : '';

    // Color the bar and status
    const coloredFailBar = chalk.red(failBar);
    const coloredPassBar = chalk.green(passBar);
    const status = result.passed ? chalk.green('✅') : chalk.red('🚩');

    console.log(`${paddedName}  ${coloredFailBar}|${coloredPassBar}  ${status} ${timeStr}`);
  });

  // Calculate pass rate
  const totalEvals = results.length;
  const passedEvals = results.filter(r => r.passed).length;
  const passRate = totalEvals > 0 ? (passedEvals / totalEvals) * 100 : 0;

  console.log();
  console.log(chalk.bold('─'.repeat(80)));

  let passRateColor = chalk.red;
  let vibeStatus = '🚩 bad vibes';
  if (passRate === 100) {
    passRateColor = chalk.green;
    vibeStatus = '✨ good vibes';
  } else if (passRate >= 80) {
    passRateColor = chalk.yellow;
    vibeStatus = '😬 sketchy vibes';
  }

  console.log(passRateColor(`Vibe Rating: ${passedEvals}/${totalEvals} (${passRate.toFixed(1)}%) - ${vibeStatus}`));
  if (totalTimeMs) {
    console.log(chalk.cyan(`Total Time: ${(totalTimeMs / 1000).toFixed(2)}s`));
  }
  if (totalCost) {
    console.log(chalk.magenta(`COGS Price: $${totalCost.cogs.toFixed(6)}`));
    console.log(chalk.magenta(`Retail Price: $${totalCost.retail.toFixed(6)}`));
  }
  console.log(chalk.bold('─'.repeat(80)));
  console.log();

  // Exit with error code if pass rate < 80%
  if (passRate < 80) {
    console.log(chalk.red('🚩 Bad vibes detected: Vibe rating below 80%\n'));
    process.exit(1);
  } else {
    console.log(chalk.green('✨ Good vibes all around!\n'));
  }
}
