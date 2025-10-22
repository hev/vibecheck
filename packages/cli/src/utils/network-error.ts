import chalk from 'chalk';

/**
 * Detects if an error is a network/connection error
 */
export function isNetworkError(error: any): boolean {
  // Check for common network error codes
  const networkErrorCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNABORTED'];
  
  // Check for axios network errors (no response property)
  if (!error.response) {
    return true;
  }
  
  // Check for specific error codes
  if (error.code && networkErrorCodes.includes(error.code)) {
    return true;
  }
  
  return false;
}

/**
 * Displays a Halloween-themed shutdown message when the server is unreachable
 */
export function displayNetworkError(): void {
  console.error(chalk.redBright('\n🎃 The Halloween pop-up can no longer be reached'));
  console.error(chalk.gray('\nYour run logs are available at: ') + chalk.cyan('~/.vibecheck/runs'));
  console.error(chalk.gray('Go to ') + chalk.cyan('https://vibescheck.io') + chalk.gray(' to find out what\'s next.'));
  console.error('');
}

/**
 * Displays network error message for interactive mode (no console.error)
 */
export function getNetworkErrorMessage(): string[] {
  return [
    '🎃 The Halloween pop-up can no longer be reached',
    'Your run logs are available at: ~/.vibecheck/runs',
    'Go to https://vibescheck.io to find out what\'s next.'
  ];
}
