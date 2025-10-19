import * as fs from 'fs';
import * as yaml from 'js-yaml';
import axios from 'axios';
import { EvalSuiteSchema, EvalResult } from '../types';
import { InteractiveUI } from '../ui/interactive';
import { runOnboarding } from './onboarding';
import { displayInvitePrompt } from '../utils/auth-error';
import { 
  fetchOrgInfo, 
  fetchSuites, 
  fetchSuite, 
  fetchRuns, 
  fetchRun, 
  fetchModels, 
  handleApiError 
} from '../utils/command-helpers';

const API_URL = process.env.VIBECHECK_URL || 'http://localhost:3000';

function getAuthHeaders() {
  const currentApiKey = process.env.VIBECHECK_API_KEY;
  
  if (!currentApiKey) {
    displayInvitePrompt();
    process.exit(1);
  }

  return {
    'Content-Type': 'application/json',
    'X-API-KEY': currentApiKey
  };
}

interface RunOptions {
  file?: string;
  debug?: boolean;
}

export async function runInteractiveCommand(options: RunOptions) {
  const ui = new InteractiveUI();
  let currentFile = options.file;

  // Set up command handler
  ui.setCommandHandler(async (command: string) => {
    const trimmedCommand = command.trim();

    // If empty command and we have a file loaded, run check
    if (trimmedCommand === '' && currentFile) {
      await runEvaluation(currentFile, ui, options.debug);
      return;
    }

    const parts = trimmedCommand.split(' ');
    const cmd = parts[0];

    if (cmd === 'check') {
      // Check command - optionally takes a file path, or use current file if empty
      const filePath = parts.length > 1 ? parts.slice(1).join(' ') : currentFile;

      if (!filePath) {
        ui.displayError('No file specified. Use :check <file> or provide -f flag');
        return;
      }

      currentFile = filePath;
      await runEvaluation(filePath, ui, options.debug);
    } else if (cmd === 'get') {
      // Get command - handle all get subcommands
      await handleGetCommand(parts.slice(1), ui, options.debug);
    } else if (cmd === 'exit' || cmd === 'quit' || cmd === 'q') {
      // Print summary to console before exiting
      await ui.printSummaryToConsole();
      ui.destroy();
      process.exit(0);
    } else if (trimmedCommand !== '') {
      ui.displayError(`Unknown command: ${cmd}. Available commands: check, get, exit`);
    }
  });

  // If a file was provided, display its content but don't run it yet
  if (currentFile) {
    try {
      if (fs.existsSync(currentFile)) {
        const fileContent = fs.readFileSync(currentFile, 'utf8');
        ui.displayFileContent(currentFile, fileContent);
      }
    } catch (error: any) {
      ui.displayError(`Error reading file: ${error.message}`);
    }
  } else {
    // No file found - start onboarding
    const createdFile = await runOnboarding(ui);
    if (createdFile) {
      currentFile = createdFile;
      ui.exitOnboarding();

      // Display the created file
      const fileContent = fs.readFileSync(createdFile, 'utf8');
      ui.displayFileContent(createdFile, fileContent);
    }
  }

  ui.render();
}

async function handleGetCommand(args: string[], ui: InteractiveUI, debug?: boolean) {
  if (args.length === 0) {
    ui.displayError('Usage: :get <noun> [identifier] [options]');
    ui.displayError('Available nouns: suites, suite, runs, run, models, org, credits');
    return;
  }

  const noun = args[0].toLowerCase();
  const identifier = args[1];
  const options = parseGetOptions(args.slice(2));

  try {
    switch (noun) {
      case 'suites':
      case 'evals':
        const suites = await fetchSuites(debug);
        ui.displaySuites(suites);
        break;

      case 'suite':
      case 'eval':
        if (!identifier) {
          ui.displayError('Suite name required. Usage: :get suite <name>');
          return;
        }
        const suite = await fetchSuite(identifier, debug);
        ui.displaySuite(suite);
        break;

      case 'runs':
        const runs = await fetchRuns(options, debug);
        ui.displayRuns(runs);
        break;

      case 'run':
        if (!identifier) {
          ui.displayError('Run ID required. Usage: :get run <id>');
          return;
        }
        const run = await fetchRun(identifier, debug);
        ui.displayRun(run);
        break;

      case 'models':
        const models = await fetchModels(debug);
        ui.displayModels(models, options);
        break;

      case 'org':
      case 'credits':
        const orgInfo = await fetchOrgInfo(debug);
        ui.displayOrgInfo(orgInfo);
        break;

      default:
        ui.displayError(`Unknown resource: ${noun}`);
        ui.displayError('Available nouns: suites, suite, runs, run, models, org, credits');
    }
  } catch (error: any) {
    ui.displayError(`Error: ${error.message}`);
  }
}

function parseGetOptions(args: string[]): any {
  const options: any = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--mcp') {
      options.mcp = true;
    } else if (arg === '--price' && i + 1 < args.length) {
      options.price = args[++i];
    } else if (arg === '--provider' && i + 1 < args.length) {
      options.provider = args[++i];
    } else if (arg === '--suite' && i + 1 < args.length) {
      options.suite = args[++i];
    } else if (arg === '--status' && i + 1 < args.length) {
      options.status = args[++i];
    } else if (arg === '--success-gt' && i + 1 < args.length) {
      options.successGt = parseInt(args[++i], 10);
    } else if (arg === '--success-lt' && i + 1 < args.length) {
      options.successLt = parseInt(args[++i], 10);
    } else if (arg === '--time-gt' && i + 1 < args.length) {
      options.timeGt = parseFloat(args[++i]);
    } else if (arg === '--time-lt' && i + 1 < args.length) {
      options.timeLt = parseFloat(args[++i]);
    } else if (arg === '--limit' && i + 1 < args.length) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === '--offset' && i + 1 < args.length) {
      options.offset = parseInt(args[++i], 10);
    }
  }
  
  return options;
}

async function runEvaluation(file: string, ui: InteractiveUI, debug?: boolean) {
  try {
    // Read YAML file
    if (!fs.existsSync(file)) {
      ui.displayError(`File not found: ${file}`);
      return;
    }

    ui.displayInfo(`Reading evaluation file: ${file}`);

    const fileContent = fs.readFileSync(file, 'utf8');

    // Store YAML content for logging
    ui.setYamlContent(fileContent);

    const data = yaml.load(fileContent);

    // Validate YAML structure
    const parseResult = EvalSuiteSchema.safeParse(data);

    if (!parseResult.success) {
      ui.displayError('Invalid YAML format 🚩');
      parseResult.error.errors.forEach(err => {
        ui.displayError(`  - ${err.path.join('.')}: ${err.message}`);
      });
      return;
    }

    const evalSuite = parseResult.data;
    ui.displayInfo('Evaluation file loaded successfully ✨');

    const requestPayload = {
      evalSuite,
      yamlContent: fileContent
    };

    const response = await axios.post(`${API_URL}/api/eval/run`, requestPayload, {
      headers: getAuthHeaders()
    });

    if (response.data.error) {
      const errorMsg = typeof response.data.error === 'string'
        ? response.data.error
        : response.data.error.message || JSON.stringify(response.data.error);
      ui.displayError(`API Error: ${errorMsg}`);
      return;
    }

    const runId = response.data.runId;
    ui.setRunId(runId);
    ui.displayInfo(`Checking vibes... Run ID: ${runId}`);

    // Stream results
    await streamResults(runId, ui, debug);

  } catch (error: any) {
    if (error.response?.status === 401) {
      ui.displayError('Unauthorized: Invalid or missing API key');
      ui.displayError('Get your API key at https://vibescheck.io');
    } else if (error.response?.status === 402) {
      const errorMsg = error.response.data?.error?.message ||
                       error.response.data?.error ||
                       'Payment required: Your credits are running low';
      ui.displayError(errorMsg);
      ui.displayError('Visit https://vibescheck.io to add credits');
    } else if (error.response?.status === 403) {
      const truncatedKey = process.env.VIBECHECK_API_KEY ? `${process.env.VIBECHECK_API_KEY.substring(0, 8)}...` : 'not set';
      ui.displayError('🔒 Forbidden: Access denied');
      ui.displayError(`URL: ${API_URL}/api/eval/run`);
      ui.displayError(`API Key: ${truncatedKey}`);
      ui.displayError('Verify your API key at https://vibescheck.io');
    } else if (error.response?.status === 500) {
      ui.displayError('Server error: The VibeCheck API encountered an error');
    } else if (error.response?.data?.error) {
      const errorMsg = typeof error.response.data.error === 'string'
        ? error.response.data.error
        : error.response.data.error.message || JSON.stringify(error.response.data.error);
      ui.displayError(`API Error: ${errorMsg}`);
    } else {
      ui.displayError(error.message);
    }
  }
}

async function streamResults(runId: string, ui: InteractiveUI, debug?: boolean) {
  // Allow polling interval to be configured via env var (default: 1000ms / 1 second)
  const pollInterval = process.env.VIBECHECK_POLL_INTERVAL
    ? parseInt(process.env.VIBECHECK_POLL_INTERVAL, 10)
    : 1000;
  let completed = false;
  let lastDisplayedCount = 0;
  let headerDisplayed = false;
  let totalTimeMs: number | undefined;

  while (!completed) {
    try {
      const response = await axios.get(`${API_URL}/api/eval/status/${runId}`, {
        headers: getAuthHeaders()
      });

      const { status, results, isUpdate, suiteName, model, systemPrompt, totalTimeMs: totalTime, error: statusError } = response.data;
      if (totalTime) {
        totalTimeMs = totalTime;
      }

      // Display header once
      if (!headerDisplayed && suiteName) {
        ui.displayEvalHeader(suiteName, model, systemPrompt, isUpdate);
        headerDisplayed = true;
      }

      if (status === 'running' && results && results.length > lastDisplayedCount) {
        for (const result of results.slice(lastDisplayedCount)) {
          await ui.displayResult(result);
        }
        lastDisplayedCount = results.length;
      } else if (status === 'completed') {
        if (results.length > lastDisplayedCount) {
          for (const result of results.slice(lastDisplayedCount)) {
            await ui.displayResult(result);
          }
        }
        completed = true;
        await ui.displaySummary(results, totalTimeMs);
      } else if (status === 'failed') {
        const errorMsg = statusError?.message || statusError || 'All evaluations failed due to execution errors';
        ui.displayError(`🚩 ${errorMsg}`);
        completed = true;
      } else if (status === 'partial_failure') {
        if (results.length > lastDisplayedCount) {
          for (const result of results.slice(lastDisplayedCount)) {
            await ui.displayResult(result);
          }
        }
        completed = true;
        ui.displayInfo('⚠️  Warning: Some evaluations failed to execute');
        if (statusError?.message || statusError) {
          const errorMsg = statusError?.message || statusError;
          ui.displayInfo(`   ${errorMsg}`);
        }
        await ui.displaySummary(results, totalTimeMs);
      } else if (status === 'timed_out') {
        if (results.length > lastDisplayedCount) {
          for (const result of results.slice(lastDisplayedCount)) {
            await ui.displayResult(result);
          }
        }
        completed = true;
        ui.displayInfo('⏱️  Evaluation suite timed out');
        if (statusError?.message || statusError) {
          const errorMsg = statusError?.message || statusError;
          ui.displayInfo(`   ${errorMsg}`);
        }
        await ui.displaySummary(results, totalTimeMs);
      } else if (status === 'error') {
        const errorMsg = statusError?.message || statusError || 'Vibe check failed';
        ui.displayError(errorMsg);
        completed = true;
      }

      if (!completed) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        ui.displayError('Unauthorized: Invalid or missing API key');
        ui.displayError('Get your API key at https://vibescheck.io');
      } else if (error.response?.status === 402) {
        const errorMsg = error.response.data?.error?.message ||
                         error.response.data?.error ||
                         'Payment required: Your credits are running low';
        ui.displayError(errorMsg);
        ui.displayError('Visit https://vibescheck.io to add credits');
      } else if (error.response?.status === 403) {
        const truncatedKey = process.env.VIBECHECK_API_KEY ? `${process.env.VIBECHECK_API_KEY.substring(0, 8)}...` : 'not set';
        ui.displayError('🔒 Forbidden: Access denied');
        ui.displayError(`URL: ${API_URL}/api/eval/status/${runId}`);
        ui.displayError(`API Key: ${truncatedKey}`);
        ui.displayError('Verify your API key at https://vibescheck.io');
      } else if (error.response?.status === 500) {
        ui.displayError('Server error: The VibeCheck API encountered an error');
      } else if (error.response?.data?.error) {
        const errorMsg = typeof error.response.data.error === 'string'
          ? error.response.data.error
          : error.response.data.error.message || JSON.stringify(error.response.data.error);
        ui.displayError(errorMsg);
      } else {
        ui.displayError(`Error polling results: ${error.message}`);
      }
      completed = true;
    }
  }
}

async function listSuites(ui: InteractiveUI) {
  try {
    ui.displayInfo('Fetching evaluation suites...');

    const response = await axios.get(`${API_URL}/api/eval/suites`, {
      headers: getAuthHeaders()
    });

    const suites = response.data.suites;

    if (!suites || suites.length === 0) {
      ui.displayInfo('No evaluation suites found');
      return;
    }

    const lines: string[] = [];
    lines.push('{bold}{cyan-fg}Available Evaluation Suites:{/cyan-fg}{/bold}');
    lines.push('');

    suites.forEach((suite: any) => {
      lines.push(`{bold}${suite.name}{/bold}`);
      lines.push(`  Model: ${suite.model}`);
      lines.push(`  Evaluations: ${suite.evaluations?.length || 0}`);
      lines.push('');
    });

    ui.displayInfo(lines.join('\n'));

  } catch (error: any) {
    if (error.response?.status === 401) {
      ui.displayError('Unauthorized: Invalid or missing API key');
      ui.displayInfo('Get your API key at https://vibescheck.io');
    } else if (error.response?.status === 500) {
      ui.displayError('Server error: The VibeCheck API encountered an error');
    } else if (error.response?.data?.error) {
      ui.displayError(`API Error: ${error.response.data.error}`);
    } else {
      ui.displayError(`Error: ${error.message}`);
    }
  }
}
