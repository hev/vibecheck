import * as fs from 'fs';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import ora from 'ora';
import { EvalSuiteSchema } from '../types';

interface ValidateOptions {
  file?: string;
  debug?: boolean;
}

export async function validateCommand(options: ValidateOptions) {
  const { file, debug } = options;

  let targetFile = file;

  // Auto-detect eval file if not provided (same logic as check command)
  if (!targetFile) {
    if (debug) {
      console.log('[DEBUG] No file specified, attempting auto-detection...');
    }
    const evalFiles = ['./evals.yaml', './eval.yaml', './evals.yml', './eval.yml'];
    for (const evalFile of evalFiles) {
      if (fs.existsSync(evalFile)) {
        targetFile = evalFile;
        if (debug) {
          console.log(`[DEBUG] Auto-detected file: ${targetFile}`);
        }
        break;
      }
    }
  }

  if (!targetFile) {
    console.error(chalk.redBright('Error: No evaluation file found'));
    console.error(chalk.gray('Please specify a file with: vibe validate <file>'));
    console.error(chalk.gray('Or create one of: evals.yaml, eval.yaml, evals.yml, eval.yml'));
    process.exit(1);
  }

  const spinner = ora(`Validating ${targetFile}...`).start();

  try {
    // Check if file exists
    if (!fs.existsSync(targetFile)) {
      spinner.fail(chalk.redBright(`File not found: ${targetFile}`));
      process.exit(1);
    }

    const fileContent = fs.readFileSync(targetFile, 'utf8');

    // Parse YAML with specific error handling
    let data;
    try {
      data = yaml.load(fileContent);
    } catch (yamlError: any) {
      spinner.fail(chalk.redBright('Failed to parse YAML file'));
      console.error(chalk.redBright('\nYAML syntax error:'));
      console.error(chalk.redBright(`  ${yamlError.message}`));

      // Provide specific guidance for duplicate key errors
      if (yamlError.message && yamlError.message.includes('duplicated mapping key')) {
        console.error(chalk.yellow('\n💡 Multiple patterns detected:'));
        console.error(chalk.gray('  Instead of multiple keys with the same name:'));
        console.error(chalk.gray('    not_match: "*pattern1*"'));
        console.error(chalk.gray('    not_match: "*pattern2*"'));
        console.error(chalk.gray('  Use an array for multiple patterns:'));
        console.error(chalk.gray('    not_match: ["*pattern1*", "*pattern2*"]'));
        console.error(chalk.gray('\n  This also applies to "match" patterns.'));
      }

      console.error(chalk.gray('\nCheck your YAML syntax and try again.'));
      console.error(chalk.gray('See https://github.com/hev/vibecheck?tab=readme-ov-file#yaml-syntax-reference for help.'));
      process.exit(1);
    }

    // Check for legacy object-based format (old DSL format no longer supported)
    if (data && typeof data === 'object' && 'evals' in data && Array.isArray(data.evals)) {
      for (const evalItem of data.evals) {
        if (evalItem && typeof evalItem === 'object' && 'checks' in evalItem) {
          const checks = evalItem.checks;
          // Legacy format: checks is an object with properties like match, min_tokens, etc.
          // New format: checks is an array or { or: [...] }
          if (checks && typeof checks === 'object' && !Array.isArray(checks) && !('or' in checks)) {
            // Check if it has any of the old property-based check keys
            const legacyKeys = ['match', 'not_match', 'min_tokens', 'max_tokens', 'semantic', 'llm_judge'];
            const hasLegacyFormat = legacyKeys.some(key => key in checks);

            if (hasLegacyFormat) {
              spinner.fail(chalk.redBright('Invalid or legacy format detected'));
              console.error(chalk.redBright('\nThe object-based checks format is no longer supported.'));
              console.error(chalk.redBright('Please update your YAML file to use the new array-based format.\n'));
              console.error(chalk.yellow('Migration Guide:'));
              console.error(chalk.gray('\nOld format (object-based):'));
              console.error(chalk.gray('  checks:'));
              console.error(chalk.gray('    match: "*hello*"'));
              console.error(chalk.gray('    min_tokens: 1'));
              console.error(chalk.gray('    max_tokens: 50'));
              console.error(chalk.gray('\nNew format (array-based for AND):'));
              console.error(chalk.gray('  checks:'));
              console.error(chalk.gray('    - match: "*hello*"'));
              console.error(chalk.gray('    - min_tokens: 1'));
              console.error(chalk.gray('    - max_tokens: 50'));
              console.error(chalk.gray('\nFor OR checks, use:'));
              console.error(chalk.gray('  checks:'));
              console.error(chalk.gray('    or:'));
              console.error(chalk.gray('      - match: "*option1*"'));
              console.error(chalk.gray('      - match: "*option2*"'));
              console.error(chalk.gray('\nSee CLI docs for more details.'));
              process.exit(1);
            }
          }
        }
      }
    }

    // Validate YAML structure against schema
    const parseResult = EvalSuiteSchema.safeParse(data);

    if (!parseResult.success) {
      spinner.fail(chalk.redBright('Invalid YAML format'));
      console.error(chalk.redBright('\nValidation errors:'));
      parseResult.error.errors.forEach(err => {
        console.error(chalk.redBright(`  - ${err.path.join('.')}: ${err.message}`));
      });
      process.exit(1);
    }

    const evalSuite = parseResult.data;
    spinner.succeed(chalk.green(`✓ Valid evaluation suite: ${targetFile}`));

    // Display summary information
    console.log();
    console.log(chalk.cyan('Suite Information:'));
    console.log(chalk.gray(`  Name: ${evalSuite.metadata.name}`));
    console.log(chalk.gray(`  Model: ${evalSuite.metadata.model}`));
    console.log(chalk.gray(`  System Prompt: ${evalSuite.metadata.system_prompt ? '✓' : '✗ (optional)'}`));
    console.log(chalk.gray(`  Evaluations: ${evalSuite.evals.length}`));

    if (evalSuite.metadata.mcp_server) {
      console.log(chalk.gray(`  MCP Server: ${evalSuite.metadata.mcp_server.url}`));
    }

    // Warning for missing system_prompt
    if (!evalSuite.metadata.system_prompt) {
      console.log();
      console.log(chalk.yellow('⚠️  Note: system_prompt is optional but recommended for better results'));
    }

    // Success - no need to call process.exit(0)
    return;
  } catch (error: any) {
    spinner.fail(chalk.redBright('Validation failed'));
    console.error(chalk.redBright(`\n${error.message}`));
    process.exit(1);
  }
}
