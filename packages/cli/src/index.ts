#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { Command } from 'commander';
import { runCommand, runInteractiveMode } from './commands/run';
import { saveCommand, listCommand, getCommand as getSuiteCommand } from './commands/suite';
import { orgCommand } from './commands/org';
import { listRunsCommand, listRunsBySuiteCommand, getRunCommand } from './commands/runs';
import { modelsCommand } from './commands/models';
import { redeemCommand } from './commands/redeem';

// Load .env from user's home directory
const os = require('os');
const homeDir = os.homedir();
const envPath = path.join(homeDir, '.vibecheck', '.env');

// Debug logging for API key loading
if (process.argv.includes('--debug')) {
  console.log(chalk.cyan('[DEBUG] Loading .env from:'), envPath);
  console.log(chalk.cyan('[DEBUG] .env file exists:'), fs.existsSync(envPath));
  
  // Check what's in the file
  if (fs.existsSync(envPath)) {
    const fileContent = fs.readFileSync(envPath, 'utf8');
    const apiKeyMatch = fileContent.match(/VIBECHECK_API_KEY=(.+)/);
    if (apiKeyMatch) {
      const fileApiKey = apiKeyMatch[1];
      console.log(chalk.cyan('[DEBUG] API key in file:'), fileApiKey.substring(0, 10) + '...');
    } else {
      console.log(chalk.cyan('[DEBUG] No VIBECHECK_API_KEY found in file'));
    }
  }
  
  // Check what's in environment
  const envApiKey = process.env.VIBECHECK_API_KEY;
  if (envApiKey) {
    console.log(chalk.cyan('[DEBUG] API key in environment:'), envApiKey.substring(0, 10) + '...');
  } else {
    console.log(chalk.cyan('[DEBUG] No VIBECHECK_API_KEY in environment'));
  }
}

dotenv.config({ path: envPath, override: true });

// Debug logging after dotenv loading
if (process.argv.includes('--debug')) {
  const finalApiKey = process.env.VIBECHECK_API_KEY;
  if (finalApiKey) {
    console.log(chalk.cyan('[DEBUG] Final API key after dotenv:'), finalApiKey.substring(0, 10) + '...');
  } else {
    console.log(chalk.cyan('[DEBUG] No API key loaded after dotenv'));
  }
}

const program = new Command();

program
  .name('vibe')
  .description('CLI tool for running language model evaluations')
  .version('0.1.0');

// Check command - runs in non-interactive mode by default, or interactive with -i/--interactive flag
const checkCommand = program
  .command('check')
  .description('Check vibes by running evaluations from a YAML file')
  .option('-f, --file <path>', 'Path to the YAML file containing evaluations')
  .option('-i, --interactive', 'Run in interactive mode')
  .option('-a, --async', 'Exit immediately after starting the run (non-blocking)')
  .action((options, command) => {
    if (options.debug) {
      console.log('[DEBUG] Commander options object:', options);
      console.log('[DEBUG] options.file from flag:', options.file);
    }

    let foundFile = options.file;

    // Auto-detect eval file if not provided
    if (!foundFile) {
      if (options.debug) {
        console.log('[DEBUG] No file specified, attempting auto-detection...');
      }
      const evalFiles = ['./evals.yaml', './eval.yaml', './evals.yml', './eval.yml'];
      for (const file of evalFiles) {
        if (fs.existsSync(file)) {
          foundFile = file;
          if (options.debug) {
            console.log(`[DEBUG] Auto-detected file: ${foundFile}`);
          }
          break;
        }
      }
    } else {
      if (options.debug) {
        console.log(`[DEBUG] Using specified file: ${foundFile}`);
      }
      // Validate that the specified file exists
      if (!fs.existsSync(foundFile)) {
        console.error(chalk.redBright(`Error: File not found: ${foundFile}`));
        process.exit(1);
      }
    }

    if (!foundFile) {
      console.error(chalk.redBright('Error: No evaluation file found or specified'));
      console.error(chalk.gray('Use -f <file> or create one of: evals.yaml, eval.yaml, evals.yml, eval.yml'));
      process.exit(1);
    }

    if (options.debug) {
      console.log(`[DEBUG] Final file to use: ${foundFile}`);
    }

    // Run interactive mode if -i/--interactive flag is present
    if (options.interactive) {
      runInteractiveMode({ file: foundFile });
    } else {
      runCommand({ file: foundFile, debug: options.debug, interactive: false, async: options.async });
    }
  });

// Add hidden debug option to check command
checkCommand.addOption(new (require('commander').Option)('-d, --debug', 'Enable debug logging (shows full request/response)').hideHelp());

// Removed: Default action was causing option conflicts with subcommands

const setCommand = program
  .command('set')
  .description('Set/save an evaluation suite from a YAML file')
  .option('-f, --file <path>', 'Path to the YAML file containing evaluations')
  .action(saveCommand);
setCommand.addOption(new (require('commander').Option)('-d, --debug', 'Enable debug logging (shows full request/response)').hideHelp());

const getCommand = program
  .command('get')
  .alias('list')
  .alias('ls')
  .description('Get suites, runs, or organization info')
  .argument('<noun>', 'Type of resource: suites|suite|evals|eval|runs|run|org|credits')
  .argument('[identifier]', 'Optional: suite name or run ID')
  .argument('[subcommand]', 'Optional: subcommand')
  .option('-l, --limit <number>', 'Limit number of results (default: 50)', (val) => parseInt(val, 10))
  .option('-o, --offset <number>', 'Offset for pagination (default: 0)', (val) => parseInt(val, 10))
  .option('--mcp', 'Filter models to only show those with MCP support')
  .option('--price <quartiles>', 'Filter models by price quartile(s): 1,2,3,4 (e.g., "1,2" for cheapest half)')
  .option('--provider <providers>', 'Filter models by provider(s), comma-separated (e.g., "anthropic,openai")')
  .option('--suite <name>', 'Filter runs by suite name')
  .option('--status <status>', 'Filter runs by status (completed, pending, failed, partial_failure)')
  .option('--success-gt <percent>', 'Filter runs with success rate greater than (0-100)', (val) => parseInt(val, 10))
  .option('--success-lt <percent>', 'Filter runs with success rate less than (0-100)', (val) => parseInt(val, 10))
  .option('--time-gt <seconds>', 'Filter runs with duration greater than (seconds)', (val) => parseFloat(val))
  .option('--time-lt <seconds>', 'Filter runs with duration less than (seconds)', (val) => parseFloat(val))
  .action((noun: string, identifier?: string, subcommand?: string, options?: any) => {
    const normalizedNoun = noun.toLowerCase();
    const debug = options?.debug || false;
    const limit = options?.limit;
    const offset = options?.offset;

    // Handle suites/suite/evals/eval
    if (['suites', 'suite', 'evals', 'eval'].includes(normalizedNoun)) {
      if (identifier) {
        getSuiteCommand(identifier, debug);
      } else {
        listCommand(debug);
      }
      return;
    }

    // Handle runs/run
    if (['runs', 'run'].includes(normalizedNoun)) {
      // vibe get runs <id>
      if (identifier) {
        getRunCommand(identifier, debug);
        return;
      }

      // vibe get runs - with limit, offset, and filters
      const listOptions: any = {};
      if (limit !== undefined) listOptions.limit = limit;
      if (offset !== undefined) listOptions.offset = offset;
      if (options?.suite) listOptions.suite = options.suite;
      if (options?.status) listOptions.status = options.status;
      if (options?.successGt !== undefined) listOptions.successGt = options.successGt;
      if (options?.successLt !== undefined) listOptions.successLt = options.successLt;
      if (options?.timeGt !== undefined) listOptions.timeGt = options.timeGt;
      if (options?.timeLt !== undefined) listOptions.timeLt = options.timeLt;
      listRunsCommand(listOptions, debug);
      return;
    }

    // Handle org/credits - vibe get org or vibe get credits
    if (['org', 'organization', 'credits'].includes(normalizedNoun)) {
      orgCommand(debug);
      return;
    }

    // Handle models - vibe get models
    if (['models', 'model'].includes(normalizedNoun)) {
      modelsCommand(debug, options?.mcp, options?.price, options?.provider);
      return;
    }

    // Unknown noun
    console.error(chalk.redBright(`Error: Unknown resource type "${noun}"`));
    console.error(chalk.gray('Valid types: suites, suite, evals, eval, runs, run, org, credits, models'));
    process.exit(1);
  });
getCommand.addOption(new (require('commander').Option)('-d, --debug', 'Enable debug logging (shows full request/response)').hideHelp());

const redeemCmd = program
  .command('redeem')
  .description('Redeem an invite code to create an organization and receive an API key')
  .argument('<code>', 'The invite code to redeem')
  .action((code: string, options: any) => {
    const debug = options?.debug || false;
    redeemCommand(code, debug);
  });
redeemCmd.addOption(new (require('commander').Option)('-d, --debug', 'Enable debug logging (shows full request/response)').hideHelp());

program.parse(process.argv);
