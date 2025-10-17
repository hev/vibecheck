import chalk from 'chalk';

/**
 * Displays a Halloween-themed message prompting users to redeem an invite code
 */
export function displayInvitePrompt(): void {
  console.error(chalk.redBright('\nUnauthorized: Invalid or missing API key'));
  console.error('');
  console.error(chalk.yellow('🎃 Enter an invite code to join the Halloween pop up! 🎃'));
  console.error('');
  console.error(chalk.gray('Usage: ') + chalk.cyan('vibe redeem <invite-code>'));
  console.error('');
}
