#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { Command } from 'commander';
import { runCommand, runInteractiveMode } from './commands/run';
import { saveCommand, listCommand, getCommand } from './commands/suite';
import { orgCommand } from './commands/org';

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
  .description('Get saved evaluation suites (list all or get by name)')
  .argument('[name]', 'Optional: name of specific suite to retrieve')
  .action((name?: string) => {
    if (name) {
      getCommand(name);
    } else {
      listCommand();
    }
  });

program
  .command('org')
  .description('Get organization information')
  .action(orgCommand);

program.parse(process.argv);
