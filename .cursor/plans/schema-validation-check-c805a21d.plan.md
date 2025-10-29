<!-- c805a21d-a6db-4c06-afbe-0780f7cc11c8 5c99967a-b107-4958-af22-49bfd9bbca48 -->
# Schema Validation Check Type

## Overview

Add `schema` as a new check type that validates LLM responses against JSON Schema or YAML schema definitions. Users can reference schema files via local paths or inline them in YAML. Schema files are uploaded to the API during `vibe set` (save) and `vibe check` (run) operations.

## Implementation Steps

### 1. Update Type Definitions (`packages/cli/src/types.ts`)

Add the new `schema` check type to `ChecksSchema`:

```typescript
schema: z.object({
  schema_file: z.string().optional(),  // Path to schema file
  schema_inline: z.any().optional(),   // Inline schema definition
  format: z.enum(['json', 'yaml']).optional().default('json')
}).refine(
  data => data.schema_file || data.schema_inline,
  { message: "Either schema_file or schema_inline must be provided" }
).optional()
```

Key files to modify:

- `packages/cli/src/types.ts` (lines 4-17)

### 2. Add Schema File Reading Utility

Create a utility function to read and parse schema files (JSON/YAML):

```typescript
// In packages/cli/src/utils/ (new file or existing util)
export function readSchemaFile(schemaPath: string): any {
  const content = fs.readFileSync(schemaPath, 'utf8');
  const ext = path.extname(schemaPath).toLowerCase();
  
  if (ext === '.json') {
    return JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    return yaml.load(content);
  }
  
  throw new Error(`Unsupported schema file format: ${ext}`);
}
```

### 3. Update `vibe set` Command (`packages/cli/src/commands/suite.ts`)

Modify `saveCommand()` to:

- Detect schema check types in the eval suite
- Read referenced schema files from disk
- Bundle schema content with the API request
```typescript
// Around line 62, after parsing evalSuite
const schemaFiles: Record<string, any> = {};

evalSuite.evals.forEach((evalItem, idx) => {
  if (evalItem.checks.schema?.schema_file) {
    const schemaPath = evalItem.checks.schema.schema_file;
    const schemaContent = readSchemaFile(schemaPath);
    schemaFiles[`eval_${idx}_schema`] = schemaContent;
  }
});

// Update request body around line 66
const requestBody = {
  evalSuite,
  yamlContent: fileContent,
  schemaFiles  // Add schema files
};
```


### 4. Update `vibe check` Command (`packages/cli/src/commands/run.ts`)

Modify `runCommand()` and `runSuiteCommand()` to:

- Read schema files when running from a local YAML file
- Include schema files in the API request payload
```typescript
// In runCommand(), around line 205
const schemaFiles: Record<string, any> = {};

evalSuite.evals.forEach((evalItem, idx) => {
  if (evalItem.checks.schema?.schema_file) {
    const schemaPath = path.resolve(path.dirname(file), evalItem.checks.schema.schema_file);
    const schemaContent = readSchemaFile(schemaPath);
    schemaFiles[`eval_${idx}_schema`] = schemaContent;
  }
});

const requestPayload = {
  evalSuite,
  yamlContent: fileContent,
  schemaFiles  // Add schema files
};
```


For `runSuiteCommand()`, schema files are already stored on the server from `vibe set`, so no additional file reading is needed.

### 5. Update Display Utilities (`packages/cli/src/utils/display.ts`)

Add formatting for schema validation results in `formatConditionalDetails()`:

```typescript
if (cond.type === 'schema') {
  // Extract validation errors from message
  const errorMatch = message.match(/validation error[s]?: (.+)/i);
  if (errorMatch) {
    return truncateText(errorMatch[1], 80);
  }
  return cond.passed ? 'Valid' : truncateText(message, 80);
}
```

### 6. Update Result Display (`packages/cli/src/commands/run.ts`)

Add schema handling in `displayResults()` around line 744:

```typescript
} else if (cond.type === 'schema') {
  const coloredDetails = cond.passed ? chalk.green(details as string) : chalk.redBright(details as string);
  console.log(`  ${status} ${cond.type.padEnd(25)} ${coloredDetails}`);
```

### 7. Add Unit Tests

Create tests in `packages/cli/src/utils/yaml-parser.test.ts`:

- Valid schema check with `schema_file`
- Valid schema check with `schema_inline`
- Both JSON and YAML format support
- Error when neither `schema_file` nor `schema_inline` provided
- Invalid file path handling

Add tests for schema file reading utility:

- Reading JSON schema files
- Reading YAML schema files
- Error handling for unsupported formats

### 8. Add Integration Tests

Create tests in `tests/integration/commands.test.ts`:

- `vibe set` with schema files
- `vibe check` with schema files
- Schema file not found errors
- Inline schema definitions

### 9. Update Documentation Examples

Create example YAML files in `examples/`:

```yaml
metadata:
  name: api-response-validation
  model: anthropic/claude-3.5-sonnet
  system_prompt: You are an API that returns JSON responses.

evals:
  - prompt: Generate a user profile with name, age, and email
    checks:
      schema:
        schema_file: ./schemas/user-profile.json
        format: json
      min_tokens: 10
      max_tokens: 200

  - prompt: Return weather data for San Francisco
    checks:
      schema:
        schema_inline:
          type: object
          properties:
            city:
              type: string
            temperature:
              type: number
            conditions:
              type: string
          required: [city, temperature]
        format: json
```

## Key Design Decisions

1. **Validation Location**: Server-side only (vibecheck API handles validation using JSON Schema validator)
2. **Schema Upload**: During both `vibe set` (for saved suites) and `vibe check` (for ad-hoc runs)
3. **File Resolution**: Relative to the YAML file's directory
4. **Format Support**: JSON and YAML via standard JSON Schema
5. **User Responsibility**: Users must craft prompts that instruct models to return structured output

## Files to Modify

- `packages/cli/src/types.ts` - Add schema check type
- `packages/cli/src/commands/suite.ts` - Handle schema files in save
- `packages/cli/src/commands/run.ts` - Handle schema files in run, update display
- `packages/cli/src/utils/display.ts` - Format schema validation results
- New: `packages/cli/src/utils/schema-reader.ts` - Schema file reading utility
- `packages/cli/src/utils/yaml-parser.test.ts` - Unit tests
- `tests/integration/commands.test.ts` - Integration tests
- `examples/api-validation.yaml` - Example usage
- `examples/schemas/user-profile.json` - Example schema

## Notes

- The vibecheck API will use a JSON Schema validator (like ajv) to perform validation
- CLI is responsible only for file reading and bundling
- Both JSON and YAML schemas will be converted to JSON Schema format
- Error messages from validation failures will be returned by the API

### To-dos

- [ ] Add schema check type to ChecksSchema in packages/cli/src/types.ts
- [ ] Create schema file reading utility in packages/cli/src/utils/
- [ ] Modify saveCommand() in suite.ts to detect and bundle schema files
- [ ] Modify runCommand() and runSuiteCommand() in run.ts to handle schema files
- [ ] Add schema formatting in display.ts and run.ts displayResults()
- [ ] Add unit tests for schema validation and schema file reading
- [ ] Add integration tests for vibe set and vibe check with schemas
- [ ] Create example YAML files and schema files in examples/
- [ ] Rebuild packages and run full test suite