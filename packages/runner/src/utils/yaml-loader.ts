import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { EvalSuite, EvalSuiteSchema } from '../types';

export class YamlLoader {
  /**
   * Loads and validates a YAML file
   */
  static loadFile(filePath: string): { suite: EvalSuite; content: string } {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');

    // Parse YAML
    return this.parseYaml(content);
  }

  /**
   * Parses and validates YAML content
   */
  static parseYaml(content: string): { suite: EvalSuite; content: string } {
    let data: any;

    // Parse YAML with error handling
    try {
      data = yaml.load(content);
    } catch (yamlError: any) {
      throw new Error(`YAML syntax error: ${yamlError.message}`);
    }

    // Check for legacy object-based format
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
              throw new Error(
                'Invalid or legacy format detected. The object-based checks format is no longer supported. ' +
                'Please update your YAML file to use the new array-based format. ' +
                'See https://github.com/hev/vibecheck for migration guide.'
              );
            }
          }
        }
      }
    }

    // Validate YAML structure
    const parseResult = EvalSuiteSchema.safeParse(data);

    if (!parseResult.success) {
      const errors = parseResult.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new Error(`Invalid YAML format: ${errors}`);
    }

    return {
      suite: parseResult.data,
      content
    };
  }
}
