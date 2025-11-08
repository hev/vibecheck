import * as fs from 'fs';
import { spawnSync } from 'child_process';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { EvalSuiteSchema, EvalResult, ConditionalResult } from '../types';
import { displaySummary } from '../utils/display';
import { displayInvitePrompt } from '../utils/auth-error';
import { writeRunOutput } from '../utils/output-writer';
import { isNetworkError, displayNetworkError } from '../utils/network-error';
import { getApiUrl } from '../utils/config';
const API_KEY = process.env.VIBECHECK_API_KEY;

function getAuthHeaders() {
  const currentApiKey = process.env.VIBECHECK_API_KEY;
  const neverPrompt = process.env.VIBECHECK_NEVER_PROMPT === 'true';
  
  if (!currentApiKey) {
    if (!neverPrompt) {
      displayInvitePrompt();
      // Trigger interactive redeem flow for users to obtain an API key
      try {
        spawnSync('vibe', ['redeem'], { stdio: 'inherit' });
      } catch {
        // ignore spawn errors in non-interactive test environments
      }
    }
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
  async?: boolean;
  model?: string | string[];
  models?: string[];
  mcp?: boolean;
  priceFilter?: string;
  providerFilter?: string;
  neverPrompt?: boolean;
}

interface SuiteRunOptions {
  suiteName: string;
  model?: string | string[];
  models?: string[];
  systemPrompt?: string;
  threads?: number;
  mcpUrl?: string;
  mcpName?: string;
  mcpToken?: string;
  debug?: boolean;
  async?: boolean;
  mcp?: boolean;
  priceFilter?: string;
  providerFilter?: string;
}

export async function runCommand(options: RunOptions) {
  const { file, debug, async: asyncMode, models, neverPrompt } = options;
  
  // Set environment variable to prevent prompting in tests
  if (neverPrompt) {
    process.env.VIBECHECK_NEVER_PROMPT = 'true';
  }

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
      spinner.fail(chalk.redBright('Failed to parse YAML file'));
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

    // Check for legacy object-based format (old DSL format no longer supported)
    if (data && typeof data === 'object' && 'evals' in data && Array.isArray(data.evals)) {
      for (const evalItem of data.evals) {
        if (evalItem && typeof evalItem === 'object' && 'checks' in evalItem) {
          const checks = evalItem.checks;
          // Legacy format: checks is an object with properties like match, min_tokens, etc.
          // New format: checks is an array or { or: [...] }
          if (checks && typeof checks === 'object' && !Array.isArray(checks) && !('or' in checks)) {
            // Check if it has any of the old property-based check keys
            const legacyKeys = ['match', 'not_match', 'min_tokens', 'max_tokens', 'semantic', 'llm_judge'];
            const hasLegacyFormat = legacyKeys.some(key => key in checks);
            
            if (hasLegacyFormat) {
              spinner.fail(chalk.redBright('Invalid or legacy format detected'));
              console.error(chalk.redBright('\nThe object-based checks format is no longer supported.'));
              console.error(chalk.redBright('Please update your YAML file to use the new array-based format.\n'));
              console.error(chalk.yellow('Migration Guide:'));
              console.error(chalk.gray('\nOld format (object-based):'));
              console.error(chalk.gray('  checks:'));
              console.error(chalk.gray('    match: "*hello*"'));
              console.error(chalk.gray('    min_tokens: 1'));
              console.error(chalk.gray('    max_tokens: 50'));
              console.error(chalk.gray('\nNew format (array-based for AND):'));
              console.error(chalk.gray('  checks:'));
              console.error(chalk.gray('    - match: "*hello*"'));
              console.error(chalk.gray('    - min_tokens: 1'));
              console.error(chalk.gray('    - max_tokens: 50'));
              console.error(chalk.gray('\nFor OR checks, use:'));
              console.error(chalk.gray('  checks:'));
              console.error(chalk.gray('    or:'));
              console.error(chalk.gray('      - match: "*option1*"'));
              console.error(chalk.gray('      - match: "*option2*"'));
              console.error(chalk.gray('\nSee CLI docs for more details.'));
              process.exit(1);
            }
          }
        }
      }
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
    spinner.succeed(chalk.green('Evaluation file loaded successfully'));

    // Warning for missing system_prompt
    if (!evalSuite.metadata.system_prompt) {
      console.log(chalk.yellow('⚠️  Warning: system_prompt is optional but recommended for better results'));
    }

    // Inform when a model flag is provided with -f/--file (file-based run)
    // because file-based runs use the YAML's model and ignore the CLI model.
    if (options.model && (!models || models.length <= 1)) {
      const providedModel = Array.isArray(options.model)
        ? options.model.join(', ')
        : options.model;
      const yamlModel = evalSuite.metadata?.model;
      const suiteName = evalSuite.metadata?.name;

      if (providedModel) {
        console.log(
          chalk.yellow(
            `Note: Ignoring model "${providedModel}" for file-based run ${file}. Using YAML model "${yamlModel}".`
          )
        );
        if (suiteName) {
          console.log(
            chalk.gray(
              `Tip: To run this suite on "${providedModel}", use: vibe check ${suiteName} -m ${providedModel}`
            )
          );
        }
      }
    }

    // Handle multi-model execution
    if (models && models.length > 1) {
      console.log(chalk.blue(`Running evaluation on ${models.length} models: ${models.join(', ')}`));
      
      const runIds: string[] = [];
      for (const model of models) {
        try {
          // Create a copy of the evalSuite with the specific model
          const modelEvalSuite = {
            ...evalSuite,
            metadata: {
              ...evalSuite.metadata,
              model: model
            }
          };

          const requestPayload = {
            evalSuite: modelEvalSuite,
            yamlContent: fileContent
          };

          if (debug) {
            console.log(chalk.cyan(`[DEBUG] Starting run for model: ${model}`));
          }

          const response = await axios.post(`${getApiUrl()}/api/eval/run`, requestPayload, {
            headers: getAuthHeaders()
          });

          if (response.data.error) {
            const errorMsg = typeof response.data.error === 'string'
              ? response.data.error
              : response.data.error.message || JSON.stringify(response.data.error);
            console.error(chalk.redBright(`API Error for model ${model}: ${errorMsg}`));
            continue; // Continue with other models
          }

          const runId = response.data.runId;
          runIds.push(runId);
          console.log(chalk.green(`Run started for ${model}! Run ID: ${runId}`));
        } catch (error: any) {
          console.error(chalk.redBright(`Failed to start run for model ${model}: ${error.message}`));
          continue; // Continue with other models
        }
      }

      console.log(chalk.cyan(`\nAll runs started! Check status with:`));
      runIds.forEach((runId, index) => {
        console.log(chalk.gray(`  vibe get run ${runId}  # ${models[index]}`));
      });
      process.exit(0);
    }

    const requestPayload = {
      evalSuite,
      yamlContent: fileContent
    };

    if (debug) {
      const headers = getAuthHeaders();
      const debugHeaders = { ...headers };
      if (debugHeaders['X-API-KEY']) {
        debugHeaders['X-API-KEY'] = `${debugHeaders['X-API-KEY'].substring(0, 10)}...`;
      }
      console.log(chalk.cyan('\n[DEBUG] Request to:'), `${getApiUrl()}/api/eval/run`);
      console.log(chalk.cyan('[DEBUG] Headers:'), JSON.stringify(debugHeaders, null, 2));
      console.log(chalk.cyan('[DEBUG] Request payload:'), JSON.stringify(requestPayload, null, 2));
      console.log();
    }

    const response = await axios.post(`${getApiUrl()}/api/eval/run`, requestPayload, {
      headers: getAuthHeaders()
    });

    if (debug) {
      console.log(chalk.cyan('[DEBUG] Response status:'), response.status);
      console.log(chalk.cyan('[DEBUG] Response data:'), JSON.stringify(response.data, null, 2));
      console.log();
    }

    if (response.data.error) {
      const errorMsg = typeof response.data.error === 'string'
        ? response.data.error
        : response.data.error.message || JSON.stringify(response.data.error);
      console.error(chalk.redBright(`API Error: ${errorMsg}`));
      process.exit(1);
    }

    const runId = response.data.runId;

    // If async mode, exit immediately after starting the run
    if (asyncMode) {
      console.log(chalk.green(`Run started successfully!`));
      console.log(chalk.cyan(`Run ID: ${runId}`));
      console.log(chalk.gray(`\nCheck status with: vibe get run ${runId}`));
      process.exit(0);
    }

    console.log(chalk.blue(`Running evaluation... Run ID: ${runId}\n`));

    // Stream results using EventSource or polling
    await streamResults(runId, debug, fileContent);

  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to run evaluation'));

    // Handle network errors first
    if (isNetworkError(error)) {
      displayNetworkError();
      process.exit(1);
    }

    // Handle specific HTTP error codes
    if (error.response?.status === 401 || error.response?.status === 403) {
      const neverPrompt = process.env.VIBECHECK_NEVER_PROMPT === 'true';
      if (!neverPrompt) {
        displayInvitePrompt();
        try {
          spawnSync('vibe', ['redeem'], { stdio: 'inherit' });
        } catch {}
      }
      process.exit(1);
    } else if (error.response?.status === 402) {
      const errorMsg = error.response.data?.error?.message ||
                       error.response.data?.error ||
                       'Payment required: Your credits are running low';
      console.error(chalk.redBright(`\n${errorMsg}`));
      console.error(chalk.gray('Visit https://vibescheck.io to add credits'));
      process.exit(1);
    } else if (error.response?.status === 500) {
      console.error(chalk.redBright('\nServer error: The VibeCheck API encountered an error'));
      process.exit(1);
    } else if (error.response?.data?.error) {
      const errorMsg = typeof error.response.data.error === 'string'
        ? error.response.data.error
        : error.response.data.error.message || JSON.stringify(error.response.data.error);
      console.error(chalk.redBright(`\nAPI Error: ${errorMsg}`));
      process.exit(1);
    } else {
      console.error(chalk.redBright(`\n${error.message}`));
      process.exit(1);
    }
  }
}

export async function runSuiteCommand(options: SuiteRunOptions) {
  const { suiteName, model, models, systemPrompt, threads, mcpUrl, mcpName, mcpToken, debug, async: asyncMode } = options;

  const spinner = ora(`Fetching suite "${suiteName}"...`).start();

  try {
    // Fetch suite from API
    const suiteResponse = await axios.get(`${getApiUrl()}/api/suite/${encodeURIComponent(suiteName)}`, {
      headers: getAuthHeaders()
    });

    if (suiteResponse.data.error) {
      spinner.fail(chalk.redBright(`Error: ${suiteResponse.data.error}`));
      process.exit(1);
    }

    const suite = suiteResponse.data.suite;
    spinner.text = 'Parsing suite...';

    // Parse YAML content from the suite with specific error handling
    let data;
    try {
      data = yaml.load(suite.yamlContent);
    } catch (yamlError: any) {
      spinner.fail(chalk.redBright('Failed to parse suite YAML'));
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
      spinner.fail(chalk.redBright('Invalid suite format'));
      console.error(chalk.redBright('\nValidation errors:'));
      parseResult.error.errors.forEach(err => {
        console.error(chalk.redBright(`  - ${err.path.join('.')}: ${err.message}`));
      });
      process.exit(1);
    }

    const evalSuite = parseResult.data;
    spinner.text = 'Applying overrides...';

    // Apply metadata overrides
    if (model && typeof model === 'string') {
      evalSuite.metadata.model = model;
    }
    if (systemPrompt !== undefined) {
      evalSuite.metadata.system_prompt = systemPrompt;
    }
    if (threads !== undefined) {
      evalSuite.metadata.threads = threads;
    }

    // Handle MCP server overrides
    if (mcpUrl || mcpName || mcpToken) {
      evalSuite.metadata.mcp_server = {
        url: mcpUrl || evalSuite.metadata.mcp_server?.url || '',
        name: mcpName || evalSuite.metadata.mcp_server?.name || '',
        authorization_token: mcpToken || evalSuite.metadata.mcp_server?.authorization_token
      };
    }

    spinner.succeed(chalk.green(`Suite "${suiteName}" loaded successfully`));

    // Warning for missing system_prompt
    if (!evalSuite.metadata.system_prompt) {
      console.log(chalk.yellow('⚠️  Warning: system_prompt is optional but recommended for better results'));
    }

    // Handle multi-model execution
    if (models && models.length > 1) {
      console.log(chalk.blue(`Running suite "${suiteName}" on ${models.length} models: ${models.join(', ')}`));
      
      const runIds: string[] = [];
      for (const modelName of models) {
        try {
          // Create a copy of the evalSuite with the specific model
          const modelEvalSuite = {
            ...evalSuite,
            metadata: {
              ...evalSuite.metadata,
              model: modelName
            }
          };

          const requestPayload = {
            evalSuite: modelEvalSuite,
            yamlContent: suite.yamlContent
          };

          if (debug) {
            console.log(chalk.cyan(`[DEBUG] Starting run for model: ${modelName}`));
          }

          const response = await axios.post(`${getApiUrl()}/api/eval/run`, requestPayload, {
            headers: getAuthHeaders()
          });

          if (response.data.error) {
            const errorMsg = typeof response.data.error === 'string'
              ? response.data.error
              : response.data.error.message || JSON.stringify(response.data.error);
            console.error(chalk.redBright(`API Error for model ${modelName} 🚩: ${errorMsg}`));
            continue; // Continue with other models
          }

          const runId = response.data.runId;
          runIds.push(runId);
          console.log(chalk.green(`Run started for ${modelName}! Run ID: ${runId}`));
        } catch (error: any) {
          console.error(chalk.redBright(`Failed to start run for model ${modelName}: ${error.message}`));
          continue; // Continue with other models
        }
      }

      console.log(chalk.cyan(`\nAll runs started! Check status with:`));
      runIds.forEach((runId, index) => {
        console.log(chalk.gray(`  vibe get run ${runId}  # ${models[index]}`));
      });
      process.exit(0);
    }

    const requestPayload = {
      evalSuite,
      yamlContent: suite.yamlContent
    };

    if (debug) {
      const headers = getAuthHeaders();
      const debugHeaders = { ...headers };
      if (debugHeaders['X-API-KEY']) {
        debugHeaders['X-API-KEY'] = `${debugHeaders['X-API-KEY'].substring(0, 10)}...`;
      }
      console.log(chalk.cyan('\n[DEBUG] Request to:'), `${getApiUrl()}/api/eval/run`);
      console.log(chalk.cyan('[DEBUG] Headers:'), JSON.stringify(debugHeaders, null, 2));
      console.log(chalk.cyan('[DEBUG] Request payload:'), JSON.stringify(requestPayload, null, 2));
      console.log();
    }

    const response = await axios.post(`${getApiUrl()}/api/eval/run`, requestPayload, {
      headers: getAuthHeaders()
    });

    if (debug) {
      console.log(chalk.cyan('[DEBUG] Response status:'), response.status);
      console.log(chalk.cyan('[DEBUG] Response data:'), JSON.stringify(response.data, null, 2));
      console.log();
    }

    if (response.data.error) {
      const errorMsg = typeof response.data.error === 'string'
        ? response.data.error
        : response.data.error.message || JSON.stringify(response.data.error);
      console.error(chalk.redBright(`API Error: ${errorMsg}`));
      process.exit(1);
    }

    const runId = response.data.runId;

    // If async mode, exit immediately after starting the run
    if (asyncMode) {
      console.log(chalk.green(`Run started successfully!`));
      console.log(chalk.cyan(`Run ID: ${runId}`));
      console.log(chalk.gray(`\nCheck status with: vibe get run ${runId}`));
      process.exit(0);
    }

    console.log(chalk.blue(`Running evaluation... Run ID: ${runId}\n`));

    // Stream results using existing function
    await streamResults(runId, debug, suite.yamlContent);

  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to run evaluation'));

    // Handle network errors first
    if (isNetworkError(error)) {
      displayNetworkError();
      process.exit(1);
    }

    // Handle specific HTTP error codes
    if (error.response?.status === 401 || error.response?.status === 403) {
      const neverPrompt = process.env.VIBECHECK_NEVER_PROMPT === 'true';
      if (!neverPrompt) {
        displayInvitePrompt();
        try {
          spawnSync('vibe', ['redeem'], { stdio: 'inherit' });
        } catch {}
      }
      process.exit(1);
    } else if (error.response?.status === 404) {
      console.error(chalk.redBright(`\nSuite "${suiteName}" not found`));
      console.error(chalk.gray('Use "vibe get suites" to list available suites'));
      process.exit(1);
    } else if (error.response?.status === 402) {
      const errorMsg = error.response.data?.error?.message ||
                       error.response.data?.error ||
                       'Payment required: Your credits are running low';
      console.error(chalk.redBright(`\n${errorMsg}`));
      console.error(chalk.gray('Visit https://vibescheck.io to add credits'));
      process.exit(1);
    } else if (error.response?.status === 500) {
      console.error(chalk.redBright('\nServer error: The VibeCheck API encountered an error'));
      process.exit(1);
    } else if (error.response?.data?.error) {
      const errorMsg = typeof error.response.data.error === 'string'
        ? error.response.data.error
        : error.response.data.error.message || JSON.stringify(error.response.data.error);
      console.error(chalk.redBright(`\nAPI Error: ${errorMsg}`));
      process.exit(1);
    } else {
      console.error(chalk.redBright(`\n${error.message}`));
      process.exit(1);
    }
  }
}

async function streamResults(runId: string, debug?: boolean, yamlContent?: string) {
  // Allow polling interval to be configured via env var (default: 1000ms / 1 second)
  const pollInterval = process.env.VIBECHECK_POLL_INTERVAL
    ? parseInt(process.env.VIBECHECK_POLL_INTERVAL, 10)
    : 1000;
  let completed = false;
  let lastDisplayedCount = 0;
  let headerDisplayed = false;
  let totalTimeMs: number | undefined;

  // Create spinner for polling
  const spinner = ora('Running evaluation...').start();

  while (!completed) {
    try {
      const response = await axios.get(`${getApiUrl()}/api/eval/status/${runId}`, {
        headers: getAuthHeaders()
      });

      if (debug) {
        console.log(chalk.cyan('[DEBUG] Poll response:'), JSON.stringify(response.data, null, 2));
        console.log();
      }

      const { status, results, isUpdate, suiteName, model, systemPrompt, totalTimeMs: totalTime, error: statusError } = response.data;
      if (totalTime) {
        totalTimeMs = totalTime;
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
        console.log(chalk.bold.cyan(`Running evaluation: ${suiteName}`));
        console.log(chalk.bold.cyan(`Model: ${model}`));
        console.log(chalk.bold.cyan(`System prompt: ${systemPrompt}`));
        console.log();
        headerDisplayed = true;
      }

      if (status === 'running' && results && results.length > lastDisplayedCount) {
        spinner.stop();
        displayResults(results.slice(lastDisplayedCount));
        lastDisplayedCount = results.length;
        spinner.start();
      } else if (status === 'completed') {
        spinner.stop();
        if (results.length > lastDisplayedCount) {
          displayResults(results.slice(lastDisplayedCount));
        }
        completed = true;
        
        // Save run output to file
        try {
          const outputPath = await writeRunOutput({
            runId,
            results,
            totalTimeMs,
            yamlContent
          });
          console.log(chalk.gray(`\nOutput saved to: ${outputPath}`));
        } catch (error: any) {
          console.log(chalk.yellow(`\nWarning: Failed to save output: ${error.message}`));
        }
        
        await displaySummary(results, totalTimeMs);
      } else if (status === 'failed') {
        spinner.stop();
        const errorMsg = statusError?.message || statusError || 'All evaluations failed due to execution errors';
        console.error(chalk.redBright(`\n❌ ${errorMsg}`));
        completed = true;
        process.exit(1);
      } else if (status === 'partial_failure') {
        spinner.stop();
        if (results.length > lastDisplayedCount) {
          displayResults(results.slice(lastDisplayedCount));
        }
        completed = true;
        console.log(chalk.yellow('\n⚠️  Warning: Some evaluations failed to execute'));
        if (statusError?.message || statusError) {
          const errorMsg = statusError?.message || statusError;
          console.log(chalk.yellow(`   ${errorMsg}`));
        }
        
        // Save run output to file
        try {
          const outputPath = await writeRunOutput({
            runId,
            results,
            totalTimeMs,
            yamlContent
          });
          console.log(chalk.gray(`\nOutput saved to: ${outputPath}`));
        } catch (error: any) {
          console.log(chalk.yellow(`\nWarning: Failed to save output: ${error.message}`));
        }
        
        await displaySummary(results, totalTimeMs);
        process.exit(1);
      } else if (status === 'timed_out') {
        spinner.stop();
        if (results.length > lastDisplayedCount) {
          displayResults(results.slice(lastDisplayedCount));
        }
        completed = true;
        console.log(chalk.yellow('\n⏱️  Evaluation suite timed out'));
        if (statusError?.message || statusError) {
          const errorMsg = statusError?.message || statusError;
          console.log(chalk.yellow(`   ${errorMsg}`));
        }
        
        // Save run output to file
        try {
          const outputPath = await writeRunOutput({
            runId,
            results,
            totalTimeMs,
            yamlContent
          });
          console.log(chalk.gray(`\nOutput saved to: ${outputPath}`));
        } catch (error: any) {
          console.log(chalk.yellow(`\nWarning: Failed to save output: ${error.message}`));
        }
        
        await displaySummary(results, totalTimeMs);
        process.exit(1);
      } else if (status === 'error') {
        spinner.stop();
        const errorMsg = statusError?.message || statusError || 'Vibe check failed';
        console.error(chalk.redBright(`\n❌ ${errorMsg}`));
        completed = true;
        process.exit(1);
      }

      if (!completed) {
        await new Promise(resolve => {
          const timer: any = setTimeout(resolve, pollInterval);
          if (typeof timer?.unref === 'function') {
            timer.unref();
          }
        });
      }
    } catch (error: any) {
      spinner.stop();
      
      // Handle network errors first
      if (isNetworkError(error)) {
        displayNetworkError();
        process.exit(1);
      }
      
      // Handle specific HTTP error codes
      if (error.response?.status === 401 || error.response?.status === 403) {
        const neverPrompt = process.env.VIBECHECK_NEVER_PROMPT === 'true';
        if (!neverPrompt) {
          displayInvitePrompt();
        }
        process.exit(1);
      } else if (error.response?.status === 402) {
        const errorMsg = error.response.data?.error?.message ||
                         error.response.data?.error ||
                         'Payment required: Your credits are running low';
        console.error(chalk.redBright(`\n${errorMsg}`));
        console.error(chalk.gray('Visit https://vibescheck.io to add credits'));
        process.exit(1);
      } else if (error.response?.status === 500) {
        console.error(chalk.redBright('\nServer error: The VibeCheck API encountered an error'));
        process.exit(1);
      } else if (error.response?.data?.error) {
        const errorMsg = typeof error.response.data.error === 'string'
          ? error.response.data.error
          : error.response.data.error.message || JSON.stringify(error.response.data.error);
        console.error(chalk.redBright(`\n${errorMsg}`));
        process.exit(1);
      } else {
        console.error(chalk.redBright(`Error polling results: ${error.message}`));
        process.exit(1);
      }
    }
  }
}

function truncatePrompt(prompt: string, maxLength: number = 100): string {
  if (prompt.length <= maxLength) {
    return prompt;
  }
  return prompt.substring(0, maxLength - 3) + '...';
}

function displayResults(results: EvalResult[]) {
  results.forEach((result) => {
    const displayName = truncatePrompt(result.prompt);
    console.log(chalk.bold(`\n${displayName}:`));
    console.log(chalk.blue(`Prompt: ${result.prompt}`));
    console.log(chalk.gray(`Response: ${result.response}`));

    result.checkResults.forEach((cond: ConditionalResult) => {
      displayConditionalResult(cond, result.response, 2);
    });

    const overallStatus = result.passed ? chalk.green('✅ PASS') : chalk.redBright('❌ FAIL');
    console.log(`  Overall: ${overallStatus}`);
  });
}

function displayConditionalResult(cond: ConditionalResult, response: string, indent: number = 2) {
  const indentStr = ' '.repeat(indent);
  const status = cond.passed ? chalk.green('✅ PASS') : chalk.redBright('❌ FAIL');
  const details = formatConditionalDetails(cond, response);

  // Apply different coloring based on conditional type
  if (cond.type === 'llm_judge') {
    // Show llm_judge details on the line below in gray
    console.log(`${indentStr}${status} ${cond.type.padEnd(25)}`);
    if (typeof details === 'string') {
      console.log(`${indentStr}    ${chalk.gray(details)}`);
    }
  } else if (cond.type === 'match' || cond.type === 'not_match') {
    // Handle match/not_match with snippet in gray (no highlighting)
    if (typeof details === 'object' && 'text' in details) {
      const { text } = details;
      console.log(`${indentStr}${status} ${cond.type.padEnd(25)} ${chalk.gray(text)}`);
    } else {
      console.log(`${indentStr}${status} ${cond.type.padEnd(25)} ${chalk.gray(details as string)}`);
    }
  } else if (cond.type === 'semantic') {
    // Green for passed, red only for failed
    const coloredDetails = cond.passed ? chalk.green(details as string) : chalk.redBright(details as string);
    console.log(`${indentStr}${status} ${cond.type.padEnd(25)} ${coloredDetails}`);
  } else if (cond.type === 'min_tokens' || cond.type === 'max_tokens') {
    // Handle token length checks
    const coloredDetails = cond.passed ? chalk.green(details as string) : chalk.redBright(details as string);
    console.log(`${indentStr}${status} ${cond.type.padEnd(25)} ${coloredDetails}`);
  } else {
    // Default: use pass/fail colors
    const coloredDetails = cond.passed ? chalk.green(details as string) : chalk.redBright(details as string);
    console.log(`${indentStr}${status} ${cond.type.padEnd(25)} ${coloredDetails}`);
  }

  // Display child results if present (for OR checks, etc.)
  if (cond.children && cond.children.length > 0) {
    cond.children.forEach((child: ConditionalResult) => {
      displayConditionalResult(child, response, indent + 2);
    });
  }
}

function formatConditionalDetails(cond: ConditionalResult, response: string): string | { text: string; highlight: string } {
  const message = cond.message || '';

  // Parse the message to extract details
  if (cond.type === 'match' || cond.type === 'not_match') {
    // Extract the pattern that was matched (or not matched)
    const match = message.match(/pattern ['"](.+?)['"]/i) || message.match(/found ['"](.+?)['"]/i) || message.match(/matches ['"](.+?)['"]/i);
    if (match) {
      const searchString = match[1];
      // Find the search string in the response to get context
      const index = response.toLowerCase().indexOf(searchString.toLowerCase());
      if (index !== -1) {
        // Get surrounding context
        const start = Math.max(0, index - 10);
        const end = Math.min(response.length, index + searchString.length + 10);
        const snippet = response.substring(start, end);
        const highlightText = response.substring(index, index + searchString.length);
        return { text: truncateText(snippet, 50), highlight: highlightText };
      }
      return truncateText(searchString, 50);
    }
    return truncateText(message, 60);
  }

  if (cond.type === 'semantic') {
    // Extract similarity percentage and threshold
    const simMatch = message.match(/similarity[:\s]+(\d+(?:\.\d+)?)/i);

    if (simMatch) {
      const similarity = parseFloat(simMatch[1]);
      // Convert to percentage if needed (values between 0-1)
      const simPercent = similarity <= 1 ? (similarity * 100).toFixed(0) : similarity.toFixed(0);
      return `${simPercent}%`;
    }
    return truncateText(message, 60);
  }

  if (cond.type === 'llm_judge') {
    // Just show PASS or the reason - the message already contains it
    return cond.passed ? 'PASS' : truncateText(message, 80);
  }

  if (cond.type === 'min_tokens' || cond.type === 'max_tokens') {
    // Extract token count and min/max
    const countMatch = message.match(/(\d+)\s+tokens?/i);
    const minMatch = message.match(/min[:\s]+(\d+)/i);
    const maxMatch = message.match(/max[:\s]+(\d+)/i);

    if (countMatch) {
      const count = countMatch[1];
      const min = minMatch ? minMatch[1] : null;
      const max = maxMatch ? maxMatch[1] : null;

      if (min && max) {
        return `Token count ${count} (min: ${min}, max: ${max})`;
      } else if (min) {
        return `Token count ${count} (min: ${min})`;
      } else if (max) {
        return `Token count ${count} (max: ${max})`;
      }
      return `Token count ${count}`;
    }
    return truncateText(message, 60);
  }

  return truncateText(message, 60);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

