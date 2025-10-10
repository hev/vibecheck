import * as fs from 'fs';
import * as yaml from 'js-yaml';
import axios from 'axios';
import { EvalSuiteSchema, EvalResult } from '../types';
import { InteractiveUI } from '../ui/interactive';

const API_URL = process.env.VIBECHECK_URL || 'http://localhost:3000';
const API_KEY = process.env.VIBECHECK_API_KEY;

function getAuthHeaders() {
  const isLocal = API_URL.includes('localhost') || API_URL.includes('127.0.0.1');

  if (!isLocal && !API_KEY) {
    throw new Error('VIBECHECK_API_KEY environment variable is required. Get your API key at https://vibescheck.io');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (!isLocal && API_KEY) {
    headers['X-API-KEY'] = API_KEY;
  }

  return headers;
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
    } else if (cmd === 'list') {
      // List command - show available suites
      await listSuites(ui);
    } else if (cmd === 'exit' || cmd === 'quit') {
      // Print summary to console before exiting
      ui.printSummaryToConsole();
      ui.destroy();
      process.exit(0);
    } else if (trimmedCommand !== '') {
      ui.displayError(`Unknown command: ${cmd}. Available commands: check, list, exit`);
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
  }

  ui.render();
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
      ui.displayError(`API Error: ${response.data.error}`);
      return;
    }

    const runId = response.data.runId;
    ui.displayInfo(`Checking vibes... Run ID: ${runId}`);

    // Stream results
    await streamResults(runId, ui, debug);

  } catch (error: any) {
    if (error.response?.status === 401) {
      ui.displayError('Unauthorized: Invalid or missing API key');
      ui.displayInfo('Get your API key at https://vibescheck.io');
    } else if (error.response?.status === 500) {
      ui.displayError('Server error: The VibeCheck API encountered an error');
    } else if (error.response?.data?.error) {
      ui.displayError(`API Error: ${error.response.data.error}`);
    } else {
      ui.displayError(error.message);
    }
  }
}

async function streamResults(runId: string, ui: InteractiveUI, debug?: boolean) {
  const pollInterval = 1000;
  let completed = false;
  let lastDisplayedCount = 0;
  let headerDisplayed = false;
  let totalTimeMs: number | undefined;

  while (!completed) {
    try {
      const response = await axios.get(`${API_URL}/api/eval/status/${runId}`, {
        headers: getAuthHeaders()
      });

      const { status, results, isUpdate, suiteName, model, systemPrompt, totalTimeMs: totalTime } = response.data;
      if (totalTime) {
        totalTimeMs = totalTime;
      }

      // Display header once
      if (!headerDisplayed && suiteName) {
        ui.displayEvalHeader(suiteName, model, systemPrompt, isUpdate);
        headerDisplayed = true;
      }

      if (status === 'running' && results && results.length > lastDisplayedCount) {
        results.slice(lastDisplayedCount).forEach((result: EvalResult) => {
          ui.displayResult(result);
        });
        lastDisplayedCount = results.length;
      } else if (status === 'completed') {
        if (results.length > lastDisplayedCount) {
          results.slice(lastDisplayedCount).forEach((result: EvalResult) => {
            ui.displayResult(result);
          });
        }
        completed = true;
        ui.displaySummary(results, totalTimeMs);
      } else if (status === 'error') {
        ui.displayError('Vibe check failed');
        completed = true;
      }

      if (!completed) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        ui.displayError('Unauthorized: Invalid or missing API key');
        ui.displayInfo('Get your API key at https://vibescheck.io');
      } else if (error.response?.status === 500) {
        ui.displayError('Server error: The VibeCheck API encountered an error');
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
