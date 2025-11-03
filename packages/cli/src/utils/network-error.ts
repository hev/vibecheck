import chalk from 'chalk';

/**
 * Detects if an error is a network/connection error
 */
export function isNetworkError(error: any): boolean {
  // If error has a response property, it means we got a response from the server
  // (even if it's an error status like 401, 500, etc.), so it's NOT a network error
  if (error.response) {
    return false;
  }
  
  // Check for common network error codes
  const networkErrorCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNABORTED'];
  
  // If there's no response and we have a network error code, it's a network error
  if (error.code && networkErrorCodes.includes(error.code)) {
    return true;
  }
  
  // Axios network errors (no response and no status) are network errors
  // But be careful: axios errors with status codes are HTTP errors, not network errors
  if (!error.response && !error.status && error.message) {
    // Check if it looks like a network error message
    const networkErrorMessages = ['network', 'timeout', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'];
    const lowerMessage = error.message.toLowerCase();
    if (networkErrorMessages.some(msg => lowerMessage.includes(msg.toLowerCase()))) {
      return true;
    }
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
