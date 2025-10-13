#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { Command } from 'commander';
import { runCommand, runInteractiveMode } from './commands/run';
import { saveCommand, listCommand, getCommand } from './commands/suite';
import { orgCommand } from './commands/org';
import { listRunsCommand, listRunsBySuiteCommand, getRunCommand, getRunLogsCommand } from './commands/runs';

// Load .env from user's home directory
const os = require('os');
const homeDir = os.homedir();
dotenv.config({ path: path.join(homeDir, '.vibecheck', '.env') });

const program = new Command();

program
  .name('vibe')
  .description('CLI tool for running language model evaluations')
  .version('1.0.0');

// Check command - launches interactive mode by default, or non-interactive with --ci flag
program
  .command('check')
  .description('Check vibes by running evaluations from a YAML file')
  .option('-f, --file <path>', 'Path to the YAML file containing evaluations')
  .option('-d, --debug', 'Enable debug logging (shows full request/response)')
  .option('-o, --output-dir <path>', 'Override output directory (default: ~/.vibecheck/runs)')
  .option('--ci', 'Run in non-interactive mode (for CI/CD)')
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
        console.error(chalk.red(`Error: File not found: ${foundFile}`));
        process.exit(1);
      }
    }

    if (!foundFile) {
      console.error(chalk.red('Error: No evaluation file found or specified'));
      console.error(chalk.gray('Use -f <file> or create one of: evals.yaml, eval.yaml, evals.yml, eval.yml'));
      process.exit(1);
    }

    if (options.debug) {
      console.log(`[DEBUG] Final file to use: ${foundFile}`);
    }

    // Run non-interactive mode if --ci flag is present
    if (options.ci) {
      runCommand({ file: foundFile, debug: options.debug, interactive: false });
    } else {
      runInteractiveMode({ file: foundFile, outputDir: options.outputDir });
    }
  });

// Removed: Default action was causing option conflicts with subcommands

program
  .command('set')
  .description('Set/save an evaluation suite from a YAML file')
  .option('-f, --file <path>', 'Path to the YAML file containing evaluations')
  .action(saveCommand);

program
  .command('get')
  .alias('list')
  .alias('ls')
  .description('Get suites, runs, or logs')
  .argument('<noun>', 'Type of resource: suites|suite|evals|eval|runs|run')
  .argument('[identifier]', 'Optional: suite name or run ID')
  .argument('[subcommand]', 'Optional: subcommand (e.g., "logs" for runs)')
  .option('-d, --debug', 'Enable debug logging (shows full request/response)')
  .option('-l, --limit <number>', 'Limit number of results (default: 50)', (val) => parseInt(val, 10))
  .option('-o, --offset <number>', 'Offset for pagination (default: 0)', (val) => parseInt(val, 10))
  .action((noun: string, identifier?: string, subcommand?: string, options?: any) => {
    const normalizedNoun = noun.toLowerCase();
    const debug = options?.debug || false;
    const limit = options?.limit;
    const offset = options?.offset;

    // Handle suites/suite/evals/eval
    if (['suites', 'suite', 'evals', 'eval'].includes(normalizedNoun)) {
      if (identifier) {
        getCommand(identifier, debug);
      } else {
        listCommand(debug);
      }
      return;
    }

    // Handle runs/run
    if (['runs', 'run'].includes(normalizedNoun)) {
      // vibe get runs <id> logs
      if (identifier && subcommand === 'logs') {
        getRunLogsCommand(identifier, debug);
        return;
      }

      // vibe get runs <id>
      if (identifier) {
        getRunCommand(identifier, debug);
        return;
      }

      // vibe get runs - with limit and offset
      const listOptions: any = {};
      if (limit !== undefined) listOptions.limit = limit;
      if (offset !== undefined) listOptions.offset = offset;
      listRunsCommand(listOptions, debug);
      return;
    }

    // Handle logs/log - vibe get logs <id>
    if (['logs', 'log'].includes(normalizedNoun)) {
      if (!identifier) {
        console.error(chalk.red('Error: logs requires a run ID'));
        console.error(chalk.gray('Usage: vibe get logs <run-id> or vibe get runs <run-id> logs'));
        process.exit(1);
      }
      getRunLogsCommand(identifier, debug);
      return;
    }

    // Unknown noun
    console.error(chalk.red(`Error: Unknown resource type "${noun}"`));
    console.error(chalk.gray('Valid types: suites, suite, evals, eval, runs, run'));
    process.exit(1);
  });

program
  .command('org')
  .description('Get organization information')
  .action(orgCommand);

program.parse(process.argv);
