import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import * as fs from 'fs';
import * as readline from 'readline';
import { saveApiKey, saveApiUrl, getConfigPath, readApiKey, debugConfig, readEnvFile, getApiUrl } from '../utils/config';

interface RedeemResponse {
  apiKey: string;
  org: {
    id: string;
    slug: string;
    name: string;
    credits: number;
  };
}

export async function redeemCommand(code: string, debug: boolean = false) {
  if (!code) {
    console.error(chalk.redBright('Error: invite code is required'));
    console.error(chalk.gray('Usage: vibe redeem <invite-code>'));
    process.exit(1);
  }

  await performRedeem({ code, debug });
}

async function performRedeem({ code, debug }: { code: string; debug: boolean }) {
  const spinner = ora('Redeeming invite code...').start();

  try {
    const url = `${getApiUrl()}/api/invites/redeem`;
    const requestBody = { code };

    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Request URL: ${url}`));
      console.log(chalk.gray(`[DEBUG] Request body: ${JSON.stringify(requestBody, null, 2)}`));
      spinner.start();
    }

    const response = await axios.post<RedeemResponse>(url, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Response status: ${response.status}`));
      console.log(chalk.gray(`[DEBUG] Response data:`), JSON.stringify(response.data, null, 2));
      spinner.start();
    }

    const { apiKey, org } = response.data;

    // Welcome back + overwrite prompt if .env exists
    const envPath = getConfigPath();
    const envExists = fs.existsSync(envPath) && readEnvFile().length > 0;
    if (envExists) {
      spinner.stop();
      console.log('');
      console.log(chalk.magenta('Welcome back! It looks like you have an existing configuration.'));
      console.log(chalk.gray(`Found: ${envPath}`));
      const shouldOverwrite = await promptYesNo(
        chalk.yellow('Would you like to overwrite your existing VIBECHECK_API_KEY? [y/N] ')
      );
      if (!shouldOverwrite) {
        // Show the fresh API key so the user can copy it elsewhere
        console.log('');
        console.log(chalk.cyan('Organization: ') + chalk.white(org.name));
        console.log(chalk.cyan('Credits: ') + chalk.white(org.credits.toFixed(1)));
        console.log(chalk.cyan('API Key: ') + chalk.white(apiKey));
        console.log('');
        console.log(chalk.gray("Your API Key is above. Save this API key as you won't be able to access it again."));
        // Exit outside try block to avoid being caught by error handling
        return;
      }
      spinner.start();
    }

    // Save API key to config
    saveApiKey(apiKey);

    // Save the API URL used for redemption to config
    saveApiUrl(getApiUrl());

    // Verify the API key was saved correctly
    if (debug) {
      const savedApiKey = readApiKey();
      debugConfig('redeem', `Verifying saved API key: ${savedApiKey ? savedApiKey.substring(0, 10) + '...' : 'null'}`);
      debugConfig('redeem', `Original API key: ${apiKey.substring(0, 10)}...`);
      debugConfig('redeem', `Keys match: ${savedApiKey === apiKey}`);
    }

    spinner.succeed(chalk.green('Successfully redeemed invite code!'));
    console.log('');
    console.log(chalk.cyan('Organization: ') + chalk.white(org.name));
    console.log(chalk.cyan('Credits: ') + chalk.white(org.credits.toFixed(1)));
    console.log(chalk.cyan('API Key: ') + chalk.white(apiKey));
    console.log('');
    console.log(chalk.gray(`API key saved to: ${getConfigPath()}`));
    console.log('');
    console.log(chalk.green('You can now run evaluations with this organization.'));
    console.log('');

    process.exit(0);
  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to redeem invite code'));

    // Handle specific HTTP error codes
    if (error.response?.status === 400) {
      const errorMsg = error.response.data?.error || 'Bad request';
      if (errorMsg.includes('expired')) {
        console.error(chalk.redBright('\n❌ Invite code expired'));
      } else if (errorMsg.includes('already been used')) {
        console.error(chalk.redBright('\n❌ This invite code has already been used'));
      } else {
        console.error(chalk.redBright(`\n❌ ${errorMsg}`));
      }
      process.exit(1);
    } else if (error.response?.status === 404) {
      console.error(chalk.redBright('\n❌ Invalid invite code'));
      process.exit(1);
    } else if (error.response?.status === 409) {
      console.error(chalk.redBright('\n❌ Organization with this code already exists'));
      process.exit(1);
    } else if (error.response?.status === 500) {
      console.error(chalk.redBright('\n❌ Failed to redeem invite code'));
      console.error(chalk.gray('Server error: The VibeCheck API encountered an error'));
      process.exit(2);
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      console.error(chalk.redBright('\nThe developer preview can no longer be reached'));
      console.error(chalk.gray('\nYour run logs are available at: ') + chalk.cyan('~/.vibecheck/runs'));
      console.error(chalk.gray('Go to ') + chalk.cyan('https://vibescheck.io') + chalk.gray(' to find out what\'s next.'));
      console.error('');
      process.exit(2);
    } else if (error.response?.data?.error) {
      console.error(chalk.redBright(`\n❌ ${error.response.data.error}`));
      process.exit(1);
    } else {
      console.error(chalk.redBright(`\n❌ ${error.message}`));
      process.exit(2);
    }
  }
}

export async function redeemFlow({ code, debug = false }: { code?: string; debug?: boolean }) {
  let finalCode = code?.trim();
  if (!finalCode) {
    printPreviewHeader();
    console.log(chalk.gray('Tip: Press Enter with no code to cancel.'));
    finalCode = (await promptLine(chalk.yellow('Enter your invite code: '))).trim();
    if (!finalCode) {
      console.log(chalk.gray('No code entered. Exiting redeem.'));
      process.exit(0);
    }
  }

  const result = await performRedeem({ code: finalCode, debug: !!debug });
  
  // If performRedeem returns early (user chose not to overwrite), exit with success
  if (result === undefined) {
    process.exit(0);
  }
}

function printPreviewHeader() {
  const lines = [
    `Welcome to the developer preview — a vibe check awaits`,
    `Join the developer preview — time for a vibe check`,
    `Step into the developer preview — commence the vibe check`,
    `Begin your developer preview journey — start your vibe check`,
    `Enter the developer preview — initiate your vibe check`,
  ];
  const pick = lines[Math.floor(Math.random() * lines.length)];
  console.log('');
  console.log(chalk.yellow(pick));
  console.log('');
}

function promptLine(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function promptYesNo(question: string): Promise<boolean> {
  const answer = (await promptLine(question)).trim().toLowerCase();
  if (answer === 'y' || answer === 'yes') return true;
  if (answer === 'n' || answer === 'no' || answer === '') return false;
  return false;
}
