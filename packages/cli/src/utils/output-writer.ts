import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EvalResult } from '../types';

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

interface RunOutputOptions {
  runId: string;
  results: EvalResult[];
  totalTimeMs?: number;
  yamlContent?: string;
  runLog?: string[];
  outputDir?: string;
}

/**
 * Writes run output to a file in the ~/.vibecheck/runs directory
 * @param options Run output details
 * @returns The path to the written file
 */
export async function writeRunOutput(options: RunOutputOptions): Promise<string> {
  const {
    runId,
    results,
    totalTimeMs,
    yamlContent,
    runLog = [],
    outputDir
  } = options;

  // Determine output directory (priority: parameter > env var > default)
  const finalOutputDir = outputDir || process.env.VIBECHECK_OUTPUT_DIR || path.join(os.homedir(), '.vibecheck', 'runs');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(finalOutputDir)) {
    fs.mkdirSync(finalOutputDir, { recursive: true });
  }

  const outputPath = path.join(finalOutputDir, `${runId}.txt`);
  const output: string[] = [];

  // Header
  output.push('='.repeat(80));
  output.push('VIBECHECK RUN OUTPUT');
  output.push('='.repeat(80));
  output.push('');
  output.push(`Run ID: ${runId}`);
  output.push(`Timestamp: ${new Date().toISOString()}`);
  output.push('');

  // YAML content
  if (yamlContent) {
    output.push('='.repeat(80));
    output.push('EVALUATION YAML');
    output.push('='.repeat(80));
    output.push('');
    output.push(yamlContent);
    output.push('');
  }

  // Execution log
  output.push('='.repeat(80));
  output.push('EXECUTION LOG');
  output.push('='.repeat(80));
  output.push('');
  if (runLog.length > 0) {
    output.push(...runLog);
  } else {
    // Generate a simple execution log from results if no runLog provided
    results.forEach((result, index) => {
      const displayName = result.prompt.length > 50 ? result.prompt.substring(0, 47) + '...' : result.prompt;
      output.push(`Eval ${index + 1}: ${displayName}`);
      output.push(`  Status: ${result.passed ? 'PASS' : 'FAIL'}`);
      output.push(`  Checks: ${result.checkResults.filter(c => c.passed).length}/${result.checkResults.length} passed`);
      if (result.executionTimeMs) {
        output.push(`  Time: ${(result.executionTimeMs / 1000).toFixed(1)}s`);
      }
      output.push('');
    });
  }
  output.push('');

  // Summary
  output.push('='.repeat(80));
  output.push('SUMMARY');
  output.push('='.repeat(80));
  output.push('');

  const displayNames = await Promise.all(results.map(r => truncatePrompt(r.prompt)));
  const maxNameLength = Math.max(...displayNames.map(n => n.length), 20);

  results.forEach((result, index) => {
    const paddedName = displayNames[index].padEnd(maxNameLength);
    const passedChecks = result.checkResults.filter(c => c.passed).length;
    const failedChecks = result.checkResults.filter(c => !c.passed).length;
    const failBar = '-'.repeat(failedChecks);
    const passBar = '+'.repeat(passedChecks);
    const timeStr = result.executionTimeMs ? `in ${(result.executionTimeMs / 1000).toFixed(1)}s` : '';
    const status = result.passed ? '✅' : '❌';

    output.push(`${paddedName}  ${failBar}|${passBar}  ${status} ${timeStr}`);
  });

  const totalEvals = results.length;
  const passedEvals = results.filter(r => r.passed).length;
  const passRate = totalEvals > 0 ? (passedEvals / totalEvals) * 100 : 0;

  output.push('');
  output.push('-'.repeat(80));

  output.push(`Success Pct: ${passedEvals}/${totalEvals} (${passRate.toFixed(1)}%)`);
  if (totalTimeMs) {
    output.push(`Total Time: ${(totalTimeMs / 1000).toFixed(2)}s`);
  }
  output.push('-'.repeat(80));
  output.push('');

  const allEvalsPassed = results.every(r => r.passed);
  if (allEvalsPassed) {
    output.push('All evals ran successfully');
  } else {
    output.push('Some evals failed');
  }

  output.push('');
  output.push(`Output saved to: ${outputPath}`);
  output.push('');

  // Write to file
  try {
    fs.writeFileSync(outputPath, output.join('\n'));
    return outputPath;
  } catch (error: any) {
    throw new Error(`Failed to write output file: ${error.message}`);
  }
}
