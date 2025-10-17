import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { saveApiKey, getConfigPath } from '../utils/config';

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

    // Save API key to config
    saveApiKey(apiKey);

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
