import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';

const API_URL = process.env.VIBECHECK_URL || 'http://localhost:3000';
const API_KEY = process.env.VIBECHECK_API_KEY;

function getAuthHeaders() {
  if (!API_KEY) {
    console.error(chalk.red('Error: VIBECHECK_API_KEY environment variable is required'));
    console.error(chalk.gray('Get your API key at https://vibescheck.io'));
    process.exit(1);
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };
}

export async function orgCommand() {
  const spinner = ora('Fetching organization info...').start();

  try {
    const response = await axios.get(`${API_URL}/api/orginfo`, {
      headers: getAuthHeaders()
    });

    if (response.data.error) {
      spinner.fail(chalk.red(`Error: ${response.data.error}`));
      process.exit(1);
    }

    spinner.stop();

    const orgInfo = response.data;

    console.log(chalk.bold('\nOrganization Information:\n'));
    console.log(chalk.cyan('Organization:') + ' ' + chalk.white(orgInfo.name));
    console.log(chalk.cyan('Slug:') + ' ' + chalk.white(orgInfo.slug));
    console.log(chalk.cyan('Status:') + ' ' + chalk.white(orgInfo.status));
    console.log(chalk.cyan('Available Credits:') + ' ' + chalk.white(orgInfo.credits.toFixed(2)));
    console.log(chalk.cyan('Created:') + ' ' + chalk.gray(new Date(orgInfo.created_at).toLocaleString()));
    console.log('');
  } catch (error: any) {
    spinner.fail(chalk.red('Failed to fetch organization info'));

    // Handle specific HTTP error codes
    if (error.response?.status === 401) {
      console.error(chalk.red('\nUnauthorized: Invalid or missing API key'));
      console.error(chalk.gray('Get your API key at https://vibescheck.io'));
      process.exit(1);
    } else if (error.response?.status === 403) {
      const truncatedKey = API_KEY ? `${API_KEY.substring(0, 8)}...` : 'not set';
      console.error(chalk.red('\n🔒 Forbidden: Access denied'));
      console.error(chalk.gray(`URL: ${API_URL}/api/orginfo`));
      console.error(chalk.gray(`API Key: ${truncatedKey}`));
      console.error(chalk.gray('Verify your API key at https://vibescheck.io'));
      process.exit(1);
    } else if (error.response?.status === 500) {
      console.error(chalk.red('\nServer error: The VibeCheck API encountered an error'));
      process.exit(1);
    } else if (error.response?.data?.error) {
      console.error(chalk.red(`\nAPI Error: ${error.response.data.error}`));
      process.exit(1);
    } else {
      console.error(chalk.red(`\n${error.message}`));
      process.exit(1);
    }
  }
}
