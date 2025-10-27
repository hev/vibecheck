#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import axios from 'axios';
import { Command } from 'commander';
import { runCommand, runInteractiveMode, runSuiteCommand, runSuiteInteractiveMode } from './commands/run';
import { runInteractiveCommand } from './commands/interactive-run';
import { saveCommand, listCommand, getCommand as getSuiteCommand } from './commands/suite';
import { orgCommand } from './commands/org';
import { listRunsCommand, listRunsBySuiteCommand, getRunCommand } from './commands/runs';
import { modelsCommand } from './commands/models';
import { redeemCommand, redeemFlow } from './commands/redeem';
import { fetchOrgInfo } from './utils/command-helpers';
import { getApiUrl } from './utils/config';
import { resolveModels } from './utils/model-resolver';

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

dotenv.config({ path: envPath, override: false });

// Debug logging after dotenv loading
if (process.argv.includes('--debug')) {
  const finalApiKey = process.env.VIBECHECK_API_KEY;
  if (finalApiKey) {
    console.log(chalk.cyan('[DEBUG] Final API key after dotenv:'), finalApiKey.substring(0, 10) + '...');
  } else {
    console.log(chalk.cyan('[DEBUG] No API key loaded after dotenv'));
  }
}

const CLI_VERSION = '0.1.2';

async function getServerVersion(apiUrl: string): Promise<string | null> {
  try {
    const response = await axios.get(`${apiUrl}/api/version`, { timeout: 5000 });
    return response.data.version || 'unknown';
  } catch (error) {
    return null;
  }
}


async function displayVersion() {
  console.log(chalk.cyan(`vibe CLI v${CLI_VERSION}`));
  
  const apiUrl = getApiUrl();
  console.log(chalk.gray(`Connected to: ${apiUrl}`));
  
  const serverVersion = await getServerVersion(apiUrl);
  if (serverVersion) {
    console.log(chalk.green(`Server version: ${serverVersion}`));
  } else {
    console.log(chalk.red('Server: unreachable'));
  }
}

const program = new Command();

program
  .name('vibe')
  .description('CLI tool for running language model evaluations');

// Override the default version command
program
  .command('version')
  .description('display version information')
  .action(async () => {
    await displayVersion();
  });

// Add version option
program
  .option('-V, --version', 'display version information')
  .on('option:version', async () => {
    await displayVersion();
    process.exit(0);
  });

program.action(async () => {
    // Check if user explicitly requested help
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      return; // Let commander handle these
    }
    // Auth preflight before launching interactive mode
    try {
      // Will trigger unauth flow if missing/invalid
      await fetchOrgInfo(false);
    } catch (error: any) {
      // Handle network errors with Halloween message
      if (error.message.includes('🎃 The Halloween pop-up can no longer be reached')) {
        console.error(error.message);
        process.exit(1);
      }
      // Ignore other auth errors - interactive mode will handle them
    }
    // Launch interactive mode with no file
    runInteractiveCommand({ file: undefined, debug: false });
  });

// Check command - runs in non-interactive mode by default, or interactive with -i/--interactive flag
const checkCommand = program
  .command('check [suite-name]')
  .description('Check vibes by running evaluations from a YAML file or saved suite')
  .option('-f, --file <path>', 'Path to the YAML file containing evaluations')
  .option('-m, --model <model-id>', 'Override model from suite metadata (supports comma-delimited list, "all", wildcards like "openai*")')
  .option('-s, --system-prompt <prompt>', 'Override system prompt from suite metadata')
  .option('-t, --threads <number>', 'Override thread count from suite metadata', parseInt)
  .option('--mcp-url <url>', 'Override or set MCP server URL')
  .option('--mcp-name <name>', 'Override or set MCP server name')
  .option('--mcp-token <token>', 'Override or set MCP server authorization token')
  .option('--mcp', 'Filter to only models with MCP support (use with -m all or wildcards)')
  .option('--price <quartiles>', 'Filter models by price quartiles (e.g., "1,2" for $ and $$)', '')
  .option('--provider <providers>', 'Filter models by provider(s), comma-separated (e.g., "openai,anthropic")', '')
  .option('-i, --interactive', 'Run in interactive mode')
  .option('-a, --async', 'Exit immediately after starting the run (non-blocking)')
  .action(async (suiteName, options, command) => {
    if (options.debug) {
      console.log('[DEBUG] Commander options object:', options);
      console.log('[DEBUG] Suite name:', suiteName);
      console.log('[DEBUG] options.file from flag:', options.file);
    }

    // Parse multi-model support
    let models: string[] = [];
    let isMultiModel = false;
    
    // Check if model specification needs resolution (contains "all" or wildcards)
    const needsResolution = options.model && (
      options.model.includes('all') || 
      options.model.includes('*') ||
      options.mcp ||
      options.price ||
      options.provider
    );
    
    if (options.model) {
      if (needsResolution) {
        // Resolve model specification with filters
        models = await resolveModels(
          options.model,
          {
            mcp: options.mcp,
            price: options.price,
            provider: options.provider
          },
          options.debug
        );
        
        if (models.length === 0) {
          console.error(chalk.redBright('No models match the specified criteria'));
          process.exit(1);
        }
        
        if (options.debug) {
          console.log(chalk.cyan(`[DEBUG] Resolved models: ${models.join(', ')}`));
        }
        
        isMultiModel = models.length > 1;
      } else {
        // Simple comma-delimited list
        models = options.model.split(',').map((m: string) => m.trim()).filter((m: string) => m.length > 0);
        isMultiModel = models.length > 1;
      }
      
      if (isMultiModel) {
        console.log(chalk.yellow('Multiple models detected - running in async mode'));
        options.async = true; // Force async mode for multi-model runs
      }
    }

    // Check for conflicts
    if (suiteName && options.file) {
      console.error(chalk.redBright('Error: Cannot specify both suite name and --file option'));
      console.error(chalk.gray('Use either: vibe check <suite-name> or vibe check -f <file>'));
      process.exit(1);
    }

    // Route to appropriate execution path
    if (suiteName) {
      // Suite-based execution
      if (options.debug) {
        console.log(`[DEBUG] Running suite-based check for: ${suiteName}`);
      }
      
      const suiteOptions = {
        suiteName,
        model: isMultiModel ? models : options.model,
        models: isMultiModel ? models : undefined,
        systemPrompt: options.systemPrompt,
        threads: options.threads,
        mcpUrl: options.mcpUrl,
        mcpName: options.mcpName,
        mcpToken: options.mcpToken,
        debug: options.debug,
        interactive: options.interactive,
        async: options.async,
        mcp: options.mcp,
        priceFilter: options.price,
        providerFilter: options.provider
      };

      if (options.interactive) {
        await runSuiteInteractiveMode(suiteOptions);
      } else {
        await runSuiteCommand(suiteOptions);
      }
    } else {
      // File-based execution (existing logic)
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
        // Launch interactive mode instead of exiting
        console.log(chalk.yellow('No evaluation file found. Launching interactive mode...\n'));
        try {
          // Auth preflight
          await fetchOrgInfo(!!options.debug);
        } catch (error: any) {
          // Handle network errors with Halloween message
          if (error.message.includes('🎃 The Halloween pop-up can no longer be reached')) {
            console.error(error.message);
            process.exit(1);
          }
          // Ignore other auth errors - interactive mode will handle them
        }
        await runInteractiveCommand({ file: undefined, debug: options.debug });
        return;
      }

      if (options.debug) {
        console.log(`[DEBUG] Final file to use: ${foundFile}`);
      }

      // Run interactive mode if -i/--interactive flag is present
      if (options.interactive) {
        try {
          // Auth preflight
          await fetchOrgInfo(!!options.debug);
        } catch (error: any) {
          // Handle network errors with Halloween message
          if (error.message.includes('🎃 The Halloween pop-up can no longer be reached')) {
            console.error(error.message);
            process.exit(1);
          }
          // Ignore other auth errors - interactive mode will handle them
        }
        runInteractiveMode({ file: foundFile });
      } else {
        runCommand({ 
          file: foundFile, 
          debug: options.debug, 
          interactive: false, 
          async: options.async,
          model: isMultiModel ? models : options.model,
          models: isMultiModel ? models : undefined,
          mcp: options.mcp,
          priceFilter: options.price,
          providerFilter: options.provider
        });
      }
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
  .option('--sort-by <field>', 'Sort runs by field: created, success, cost, time, price-performance (default: created)')
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
      if (options?.sortBy) listOptions.sortBy = options.sortBy;
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
  .argument('[code]', 'The invite code to redeem (optional)')
  .action((code: string | undefined, options: any) => {
    const debug = options?.debug || false;
    redeemFlow({ code, debug });
  });
redeemCmd.addOption(new (require('commander').Option)('-d, --debug', 'Enable debug logging (shows full request/response)').hideHelp());

program.parse(process.argv);
