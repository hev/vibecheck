import * as fs from 'fs';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { EvalSuiteSchema } from '../types';
import { displayInvitePrompt } from '../utils/auth-error';
import { isNetworkError, displayNetworkError } from '../utils/network-error';
import { getApiUrl } from '../utils/config';

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

interface SaveOptions {
  file?: string;
  debug?: boolean;
}

export async function saveCommand(options: SaveOptions) {
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
    
    // Parse YAML with specific error handling
    let data;
    try {
      data = yaml.load(fileContent);
    } catch (yamlError: any) {
      spinner.fail(chalk.redBright('Failed to parse YAML file 🚩'));
      console.error(chalk.redBright('\nYAML syntax error:'));
      console.error(chalk.redBright(`  ${yamlError.message}`));
      
      // Provide specific guidance for duplicate key errors
      if (yamlError.message && yamlError.message.includes('duplicated mapping key')) {
        console.error(chalk.yellow('\n💡 Multiple patterns detected:'));
        console.error(chalk.gray('  Instead of multiple keys with the same name:'));
        console.error(chalk.gray('    not_match: "*pattern1*"'));
        console.error(chalk.gray('    not_match: "*pattern2*"'));
        console.error(chalk.gray('  Use an array for multiple patterns:'));
        console.error(chalk.gray('    not_match: ["*pattern1*", "*pattern2*"]'));
        console.error(chalk.gray('\n  This also applies to "match" patterns.'));
      }
      
      console.error(chalk.gray('\nCheck your YAML syntax and try again.'));
      console.error(chalk.gray('See https://github.com/hev/vibecheck?tab=readme-ov-file#yaml-syntax-reference for help.'));
      process.exit(1);
    }

    // Validate YAML structure
    const parseResult = EvalSuiteSchema.safeParse(data);

    if (!parseResult.success) {
      spinner.fail(chalk.redBright('Invalid YAML format'));
      console.error(chalk.redBright('\nValidation errors:'));
      parseResult.error.errors.forEach(err => {
        console.error(chalk.redBright(`  - ${err.path.join('.')}: ${err.message}`));
      });
      process.exit(1);
    }

    const evalSuite = parseResult.data;
    spinner.text = 'Saving suite...';

    const url = `${getApiUrl()}/api/suite/save`;
    const requestBody = {
      evalSuite,
      yamlContent: fileContent
    };

    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Request URL: ${url}`));
      console.log(chalk.gray(`[DEBUG] Request body: ${JSON.stringify(requestBody, null, 2)}`));
      spinner.start();
    }

    // Send to API
    const response = await axios.post(url, requestBody, {
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

    spinner.succeed(chalk.green(`Suite "${evalSuite.metadata.name}" saved successfully`));
    console.log(chalk.cyan(`Suite name: ${evalSuite.metadata.name}`));
  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to save suite'));

    // Handle network errors first
    if (isNetworkError(error)) {
      displayNetworkError();
      process.exit(1);
    }

    // Handle specific HTTP error codes
    if (error.response?.status === 401 || error.response?.status === 403) {
      displayInvitePrompt();
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
}

export async function listCommand(debug: boolean = false) {
  const spinner = ora('Fetching suites...').start();

  try {
    const url = `${getApiUrl()}/api/suite/list`;
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

    const suites = response.data.suites;

    if (suites.length === 0) {
      console.log(chalk.yellow('No suites found'));
      return;
    }

    console.log(chalk.bold('\nAvailable Suites:\n'));
    console.log(chalk.bold('Name'.padEnd(30)) + chalk.bold('Last Run'.padEnd(25)) + chalk.bold('Last Edit'.padEnd(25)) + chalk.bold('# Evals'));
    console.log('='.repeat(100));

    suites.forEach((suite: any) => {
      const lastRun = suite.lastRun ? new Date(suite.lastRun).toLocaleString() : 'Never';
      const lastEdit = new Date(suite.lastEdit).toLocaleString();

      console.log(
        chalk.cyan(suite.name.padEnd(30)) +
        chalk.gray(lastRun.padEnd(25)) +
        chalk.gray(lastEdit.padEnd(25)) +
        chalk.white(suite.evalCount)
      );
    });

    console.log('');
  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to list suites'));

    // Handle network errors first
    if (isNetworkError(error)) {
      displayNetworkError();
      process.exit(1);
    }

    // Handle specific HTTP error codes
    if (error.response?.status === 401 || error.response?.status === 403) {
      displayInvitePrompt();
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
}

export async function getCommand(name: string, debug: boolean = false) {
  if (!name) {
    console.error(chalk.redBright('Error: suite name is required'));
    console.error(chalk.gray('Usage: vibe get <name>'));
    process.exit(1);
  }

  const spinner = ora(`Fetching suite "${name}"...`).start();

  try {
    const url = `${getApiUrl()}/api/suite/${encodeURIComponent(name)}`;
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

    const suite = response.data.suite;
    console.log(suite.yamlContent);
  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to get suite'));

    // Handle network errors first
    if (isNetworkError(error)) {
      displayNetworkError();
      process.exit(1);
    }

    // Handle specific HTTP error codes
    if (error.response?.status === 401 || error.response?.status === 403) {
      displayInvitePrompt();
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
}
