import chalk from 'chalk';
import { EvalResult } from '../types';

// Configurable table width - easy to tweak
const TABLE_WIDTH = 90;

// Cache for stringWidth function to avoid repeated dynamic imports
let stringWidthCache: any = null;

async function getStringWidth() {
  if (!stringWidthCache) {
    try {
      // Use eval to avoid TypeScript compilation issues with dynamic imports
      const stringWidthModule = await eval('import("string-width")');
      stringWidthCache = stringWidthModule.default;
    } catch (error) {
      // Fallback to a simple character width calculation if string-width fails
      console.warn('Warning: string-width module not available, using fallback character width calculation');
      stringWidthCache = (str: string) => str.length; // Simple fallback
    }
  }
  return stringWidthCache;
}

async function truncatePrompt(prompt: string, maxLength: number = 100): Promise<string> {
  const stringWidth = await getStringWidth();
  const visualWidth = stringWidth(prompt);
  if (visualWidth <= maxLength) {
    return prompt;
  }
  
  // Truncate by visual width, not character count
  let truncated = '';
  let currentWidth = 0;
  
  for (const char of prompt) {
    const charWidth = stringWidth(char);
    if (currentWidth + charWidth > maxLength - 3) {
      break;
    }
    truncated += char;
    currentWidth += charWidth;
  }
  
  return truncated + '...';
}

export async function displaySummary(results: EvalResult[], totalTimeMs?: number) {
  console.log();
  console.log(chalk.bold('─'.repeat(TABLE_WIDTH)));
  console.log(chalk.bold('✨ VIBE CHECK SUMMARY ✨'));
  console.log(chalk.bold('─'.repeat(TABLE_WIDTH)));
  console.log();

  // Find the longest eval name for padding - use truncated prompts
  const displayNames = await Promise.all(results.map(r => truncatePrompt(r.prompt)));
  
  // Calculate padding to use full table width minus space for results
  // Reserve space for: "  " + "|" + "  " + "✅" + " in X.Xs" (approximately 15 chars)
  const resultsSpace = 15;
  const maxNameLength = Math.max(TABLE_WIDTH - resultsSpace, 20);

  // Get stringWidth function for padding calculation
  const stringWidth = await getStringWidth();

  // Display each eval with visual bar chart
  results.forEach((result, index) => {
    const displayName = displayNames[index];
    const nameWidth = stringWidth(displayName);
    const padding = Math.max(0, maxNameLength - nameWidth);
    const paddedName = displayName + ' '.repeat(padding);

    // Calculate pass/fail counts for checks - one character per check
    const passedChecks = result.checkResults.filter(c => c.passed).length;
    const failedChecks = result.checkResults.filter(c => !c.passed).length;

    // Create visual bar - one + or - per conditional
    const failBar = '-'.repeat(failedChecks);
    const passBar = '+'.repeat(passedChecks);

    // Format time
    const timeStr = result.executionTimeMs
      ? `in ${(result.executionTimeMs / 1000).toFixed(1)}s`
      : '';

    // Color the bar and status
    const coloredFailBar = chalk.redBright(failBar);
    const coloredPassBar = chalk.green(passBar);
    const status = result.passed ? chalk.green('✅') : chalk.redBright('🚩');

    console.log(`${paddedName}  ${coloredFailBar}|${coloredPassBar}  ${status} ${timeStr}`);
  });

  // Calculate pass rate
  const totalEvals = results.length;
  const passedEvals = results.filter(r => r.passed).length;
  const passRate = totalEvals > 0 ? (passedEvals / totalEvals) * 100 : 0;

  console.log();
  console.log(chalk.bold('─'.repeat(TABLE_WIDTH)));

  let passRateColor = chalk.redBright;
  let vibeStatus = '🚩 bad vibes';
  if (passRate > 80) {
    passRateColor = chalk.green;
    vibeStatus = '✨ good vibes';
  } else if (passRate >= 50) {
    passRateColor = chalk.yellow;
    vibeStatus = '😬 sketchy vibes';
  }

  console.log(passRateColor(`Vibe Rating: ${passedEvals}/${totalEvals} (${passRate.toFixed(1)}%) - ${vibeStatus}`));
  if (totalTimeMs) {
    console.log(chalk.cyan(`Total Time: ${(totalTimeMs / 1000).toFixed(2)}s`));
  }
  console.log(chalk.bold('─'.repeat(TABLE_WIDTH)));
  console.log();

  // Display vibe status (don't exit with error code - failed evals are valid results)
  if (passRate < 50) {
    console.log(chalk.redBright('🚩 Bad vibes detected: Vibe rating below 50%\n'));
  } else {
    console.log(chalk.green('✨ Good vibes all around!\n'));
  }
}
