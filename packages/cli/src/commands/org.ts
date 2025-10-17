import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { displayInvitePrompt } from '../utils/auth-error';

const API_URL = process.env.VIBECHECK_URL || 'http://localhost:3000';

function getAuthHeaders() {
  const currentApiKey = process.env.VIBECHECK_API_KEY;
  
  if (!currentApiKey) {
    displayInvitePrompt();
    process.exit(1);
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentApiKey}`
  };
}

export async function orgCommand(debug: boolean = false) {
  const spinner = ora('Fetching organization info...').start();

  try {
    const url = `${API_URL}/api/orginfo`;
    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Request URL: ${url}`));
      spinner.start();
    }

    const response = await axios.get(url, {
      headers: getAuthHeaders()
    });

    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Response status: ${response.status}`));
      console.log(chalk.gray(`[DEBUG] Response data:`), JSON.stringify(response.data, null, 2));
      spinner.start();
    }

    if (response.data.error) {
      spinner.fail(chalk.redBright(`Error: ${response.data.error}`));
      process.exit(1);
    }

    spinner.stop();

    const orgInfo = response.data;

    console.log(chalk.bold('\nOrganization Information:\n'));
    console.log(chalk.cyan('Organization:') + ' ' + chalk.white(orgInfo.name));
    console.log(chalk.cyan('Slug:') + ' ' + chalk.white(orgInfo.slug));
    console.log(chalk.cyan('Status:') + ' ' + chalk.white(orgInfo.status));

    // Color code credits based on amount
    const creditsAmount = `$${orgInfo.credits.toFixed(2)}`;
    const creditsColor = orgInfo.credits < 1.00 ? chalk.redBright : chalk.white;
    console.log(
      chalk.cyan('Available Credits:') + ' ' +
      creditsColor(creditsAmount) +
      chalk.gray(' (Credit balance may be delayed.)')
    );

    console.log(chalk.cyan('Created:') + ' ' + chalk.gray(new Date(orgInfo.created_at).toLocaleString()));
    console.log('');
  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to fetch organization info'));

    // Handle specific HTTP error codes
    if (error.response?.status === 401 || error.response?.status === 403) {
      displayInvitePrompt();
      process.exit(1);
    } else if (error.response?.status === 500) {
      console.error(chalk.redBright('\nServer error: The VibeCheck API encountered an error'));
      process.exit(1);
    } else if (error.response?.data?.error) {
      console.error(chalk.redBright(`\nAPI Error: ${error.response.data.error}`));
      process.exit(1);
    } else {
      console.error(chalk.redBright(`\n${error.message}`));
      process.exit(1);
    }
  }
}
