import chalk from 'chalk';

/**
 * Displays a developer preview message prompting users to redeem an invite code
 */
export function displayInvitePrompt(): void {
  console.error(chalk.redBright('\nUnauthorized: Invalid or missing API key'));
  console.error('');
  console.error(chalk.yellow('vibe check is currently invite only. Enter your code to proceed.'));
  console.error('');
  console.error(chalk.gray('Need an invite? Visit ') + chalk.cyan('https://vibescheck.io'));
  console.error(chalk.gray('Have an invite? Use ') + chalk.cyan('vibe redeem') + chalk.gray(' to set up your API key'));
  console.error('');
}
