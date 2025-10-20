import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import * as fs from 'fs';
import * as readline from 'readline';
import { saveApiKey, getConfigPath, readApiKey, debugConfig, readEnvFile } from '../utils/config';

const API_URL = process.env.VIBECHECK_URL || 'http://localhost:3000';

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
    const url = `${API_URL}/api/invites/redeem`;
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
      console.log(chalk.magenta('🦇 Welcome back, ghoulfriend! It looks like you have an existing coffin (config).'));
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
        process.exit(0);
      }
      spinner.start();
    }

    // Save API key to config
    saveApiKey(apiKey);

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
      console.error(chalk.redBright('\n❌ Failed to connect to VibeCheck server'));
      console.error(chalk.gray(`URL: ${API_URL}`));
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        console.error(chalk.gray('Request timed out after 30 seconds'));
      }
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
    printSpookyHeader();
    console.log(chalk.gray('Tip: Press Enter with no code to cancel.'));
    finalCode = (await promptLine(chalk.yellow('Enter your invite code: '))).trim();
    if (!finalCode) {
      console.log(chalk.gray('No code entered. Exiting redeem.'));
      process.exit(0);
    }
  }

  await performRedeem({ code: finalCode, debug: !!debug });
}

function printSpookyHeader() {
  const pumpkin = '🎃';
  const ghost = '👻';
  const lines = [
    `${pumpkin} meet your redeemer — a vibe check awaits`,
    `${ghost} something wicked this way comes — time for a vibe check`,
    `${pumpkin} step into the circle — commence the vibe check`,
    `${ghost} heed the call of the night — begin your vibe check`,
    `${pumpkin} from the crypt we rise — initiate your vibe check`,
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
