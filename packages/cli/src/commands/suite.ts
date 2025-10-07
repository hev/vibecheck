import * as fs from 'fs';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { EvalSuiteSchema } from '@evalit/shared';

const API_URL = process.env.EVALIT_API_URL || 'http://localhost:3000';

interface SaveOptions {
  file?: string;
}

export async function saveCommand(options: SaveOptions) {
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
      spinner.fail(chalk.red('Invalid YAML format'));
      console.error(chalk.red('\nValidation errors:'));
      parseResult.error.errors.forEach(err => {
        console.error(chalk.red(`  - ${err.path.join('.')}: ${err.message}`));
      });
      process.exit(1);
    }

    const evalSuite = parseResult.data;
    spinner.text = 'Saving suite...';

    // Send to API
    const response = await axios.post(`${API_URL}/api/suite/save`, {
      evalSuite,
      yamlContent: fileContent
    });

    if (response.data.error) {
      spinner.fail(chalk.red(`Error: ${response.data.error}`));
      process.exit(1);
    }

    spinner.succeed(chalk.green(`Suite "${evalSuite.metadata.name}" saved successfully`));
  } catch (error: any) {
    spinner.fail(chalk.red('Failed to save suite'));
    if (error.response?.data?.error) {
      console.error(chalk.red(`\nAPI Error: ${error.response.data.error}`));
    } else {
      console.error(chalk.red(`\n${error.message}`));
    }
    process.exit(1);
  }
}

export async function listCommand() {
  const spinner = ora('Fetching suites...').start();

  try {
    const response = await axios.get(`${API_URL}/api/suite/list`);

    if (response.data.error) {
      spinner.fail(chalk.red(`Error: ${response.data.error}`));
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
    spinner.fail(chalk.red('Failed to list suites'));
    if (error.response?.data?.error) {
      console.error(chalk.red(`\nAPI Error: ${error.response.data.error}`));
    } else {
      console.error(chalk.red(`\n${error.message}`));
    }
    process.exit(1);
  }
}

export async function getCommand(name: string) {
  if (!name) {
    console.error(chalk.red('Error: suite name is required'));
    console.error(chalk.gray('Usage: vibe get <name>'));
    process.exit(1);
  }

  const spinner = ora(`Fetching suite "${name}"...`).start();

  try {
    const response = await axios.get(`${API_URL}/api/suite/${encodeURIComponent(name)}`);

    if (response.data.error) {
      spinner.fail(chalk.red(`Error: ${response.data.error}`));
      process.exit(1);
    }

    spinner.stop();

    const suite = response.data.suite;
    console.log(suite.yamlContent);
  } catch (error: any) {
    spinner.fail(chalk.red('Failed to get suite'));
    if (error.response?.data?.error) {
      console.error(chalk.red(`\nAPI Error: ${error.response.data.error}`));
    } else {
      console.error(chalk.red(`\n${error.message}`));
    }
    process.exit(1);
  }
}
