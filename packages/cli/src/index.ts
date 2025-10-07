#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { Command } from 'commander';
import { runCommand } from './commands/run';
import { saveCommand, listCommand, getCommand } from './commands/suite';

// Load .env from the package directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const program = new Command();

program
  .name('vibe')
  .description('CLI tool for running language model evaluations')
  .version('1.0.0');

// Commands
program
  .command('check')
  .description('Check vibes by running evaluations from a YAML file')
  .option('-f, --file <path>', 'Path to the YAML file containing evaluations')
  .action(runCommand);

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

program.parse(process.argv);
