import chalk from 'chalk';
import { EvalResult } from '../types';

export function displaySummary(results: EvalResult[], totalTimeMs?: number) {
  console.log();
  console.log(chalk.bold('─'.repeat(80)));
  console.log(chalk.bold('✨ VIBE CHECK SUMMARY ✨'));
  console.log(chalk.bold('─'.repeat(80)));
  console.log();

  // Find the longest eval name for padding
  const maxNameLength = Math.max(...results.map(r => r.evalName.length), 20);

  // Display each eval with visual bar chart
  results.forEach((result) => {
    const paddedName = result.evalName.padEnd(maxNameLength);

    // Calculate pass/fail counts for conditionals - one character per conditional
    const passedConditionals = result.conditionalResults.filter(c => c.passed).length;
    const failedConditionals = result.conditionalResults.filter(c => !c.passed).length;

    // Create visual bar - one + or - per conditional
    const failBar = '-'.repeat(failedConditionals);
    const passBar = '+'.repeat(passedConditionals);

    // Format time
    const timeStr = result.executionTimeMs
      ? `in ${(result.executionTimeMs / 1000).toFixed(1)}s`
      : '';

    // Color the bar and status
    const coloredFailBar = chalk.red(failBar);
    const coloredPassBar = chalk.green(passBar);
    const status = result.passed ? chalk.green('✅') : chalk.red('🚩');

    console.log(`${paddedName}  ${coloredFailBar}|${coloredPassBar}  ${status} ${timeStr}`);
  });

  // Calculate pass rate
  const totalEvals = results.length;
  const passedEvals = results.filter(r => r.passed).length;
  const passRate = totalEvals > 0 ? (passedEvals / totalEvals) * 100 : 0;

  console.log();
  console.log(chalk.bold('─'.repeat(80)));

  let passRateColor = chalk.red;
  let vibeStatus = '🚩 bad vibes';
  if (passRate === 100) {
    passRateColor = chalk.green;
    vibeStatus = '✨ good vibes';
  } else if (passRate >= 80) {
    passRateColor = chalk.yellow;
    vibeStatus = '😬 sketchy vibes';
  }

  console.log(passRateColor(`Vibe Rating: ${passedEvals}/${totalEvals} (${passRate.toFixed(1)}%) - ${vibeStatus}`));
  if (totalTimeMs) {
    console.log(chalk.cyan(`Total Time: ${(totalTimeMs / 1000).toFixed(2)}s`));
  }
  console.log(chalk.bold('─'.repeat(80)));
  console.log();

  // Display vibe status (don't exit with error code - failed evals are valid results)
  if (passRate < 80) {
    console.log(chalk.red('🚩 Bad vibes detected: Vibe rating below 80%\n'));
  } else {
    console.log(chalk.green('✨ Good vibes all around!\n'));
  }
}
