# Add support for multi-turn evals

## Summary

Currently, vibecheck supports single-turn evaluations where a prompt is sent to the model and checks are validated against the response. This feature adds support for **multi-turn conversations** where follow-up prompts can be sent when initial checks fail, enabling more sophisticated evaluation workflows like iterative refinement, error correction, and conversational testing.

## Use Case

Multi-turn evals are useful for:

1. **Iterative Refinement**: Test if a model can improve its response when given feedback
2. **Error Correction**: Verify that models can correct mistakes when prompted
3. **Conversational Testing**: Evaluate models in multi-turn dialogue scenarios
4. **Progressive Evaluation**: Test models with increasingly specific prompts
5. **Self-Correction**: Check if models can identify and fix their own errors

**Example scenarios:**
- Ask a math question, and if the answer is wrong, prompt the model to reconsider
- Request code generation, and if it doesn't compile, ask for corrections
- Test translation quality with follow-up refinement requests

## Current Behavior

Currently, the YAML format only supports single-turn evaluations:

```yaml
evals:
  - prompt: What is 2 + 2?
    checks:
      - match: "*4*"
```

If checks fail, the evaluation simply fails. There's no mechanism to send follow-up prompts based on check results.

## Desired Behavior

Support nested prompts within checks that are executed when those checks fail. The format uses indentation to represent the conversation depth, with a maximum depth of 5 layers to prevent excessive token usage.

### YAML Format

Follow-up prompts are nested within checks using indentation. When a check fails, the nested prompt is sent as a follow-up message, and its checks are evaluated:

```yaml
metadata:
  name: multi-turn-example
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: What is 2 + 2?
    checks:
      - match: "*4*"
      - prompt: That's not quite right. Please reconsider your answer.
        checks:
          - match: "*4*"
          - min_tokens: 5
          - prompt: Let me help you. The answer is a single digit number.
            checks:
              - match: "*4*"
```

### Detailed Format Specification

1. **Nested prompts**: A `prompt` field can appear at the same indentation level as checks within a `checks` array
2. **Execution flow**: When a check fails, if there's a nested `prompt` at the same level, it is sent as a follow-up
3. **Recursive structure**: Nested prompts can themselves contain checks with further nested prompts
4. **Depth limit**: Maximum of 5 nested levels (arbitrary limit to prevent token burn)
5. **Check evaluation**: All checks at a given level must pass before moving to nested prompts
6. **Success condition**: The evaluation passes if all checks pass at any level, or if a nested prompt's checks pass

### Example: Math Problem with Correction

```yaml
metadata:
  name: math-correction
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: What is 15 * 7?
    checks:
      - match: "*105*"
      - prompt: That answer is incorrect. Please recalculate 15 multiplied by 7.
        checks:
          - match: "*105*"
          - prompt: Hint: 15 * 7 = 10*7 + 5*7. What is the answer?
            checks:
              - match: "*105*"
```

### Example: Code Generation with Iterative Refinement

```yaml
metadata:
  name: code-refinement
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: Write a Python function that returns the sum of two numbers.
    checks:
      - match: "*def*"
      - match: "*return*"
      - match: "*+*"
      - prompt: Your function has a syntax error. Please fix it and provide a corrected version.
        checks:
          - match: "*def*"
          - match: "*return*"
          - not_match: "*SyntaxError*"
          - prompt: The function should handle edge cases. Add input validation.
            checks:
              - match: "*def*"
              - match: "*isinstance*"
              - match: "*return*"
```

### Example: Translation Quality with Refinement

```yaml
metadata:
  name: translation-refinement
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: Translate "Hello, how are you?" to Spanish.
    checks:
      - match: "*Hola*"
      - match: "*cómo*"
      - llm_judge:
          criteria: "Is this an accurate and natural Spanish translation?"
      - prompt: The translation could be more natural. Please provide a more idiomatic Spanish translation.
        checks:
          - match: "*Hola*"
          - llm_judge:
              criteria: "Is this translation more natural and idiomatic than the previous attempt?"
```

## Technical Implementation

### Schema Changes

The `ChecksSchema` needs to be extended to support nested prompts. The current structure is:

```typescript
export const ChecksSchema = z.union([
  z.array(CheckSchema),
  z.object({
    or: z.array(CheckSchema).min(1)
  }).strict()
]);
```

**Proposed change**: Allow `prompt` as an optional field within check objects, creating a recursive structure:

```typescript
// Base check types remain the same
const CheckSchema = z.union([
  MatchCheckSchema,
  NotMatchCheckSchema,
  MinTokensCheckSchema,
  MaxTokensCheckSchema,
  SemanticCheckSchema,
  LLMJudgeCheckSchema
]);

// Extended check that can include nested prompts
const CheckWithPromptSchema = CheckSchema.extend({
  prompt: z.string().optional(),
  checks: ChecksSchema.optional()  // Recursive reference
}).refine(
  (val) => {
    // If prompt is provided, checks must also be provided
    if (val.prompt !== undefined) {
      return val.checks !== undefined;
    }
    return true;
  },
  { message: "prompt requires checks to be defined" }
);

// Updated ChecksSchema with depth limit
const createChecksSchema = (maxDepth: number = 5): z.ZodTypeAny => {
  if (maxDepth <= 0) {
    return CheckSchema; // Base case: no more nesting
  }
  
  const NestedCheckSchema = CheckSchema.extend({
    prompt: z.string().optional(),
    checks: z.lazy(() => createChecksSchema(maxDepth - 1)).optional()
  }).refine(
    (val) => val.prompt === undefined || val.checks !== undefined,
    { message: "prompt requires checks to be defined" }
  );

  return z.union([
    z.array(NestedCheckSchema),
    z.object({
      or: z.array(NestedCheckSchema).min(1)
    }).strict()
  ]);
};

export const ChecksSchema = createChecksSchema(5);
```

### Execution Flow

1. **Initial prompt**: Send the eval's `prompt` to the model
2. **Check evaluation**: Evaluate all checks against the response
3. **Failure handling**: If any check fails:
   - Find the first failed check that has a nested `prompt`
   - Send the nested `prompt` as a follow-up message (maintaining conversation context)
   - Evaluate the nested `checks` against the new response
   - Recursively continue if nested checks fail and have further nested prompts
4. **Success condition**: The eval passes if:
   - All initial checks pass, OR
   - Any nested prompt's checks pass (after initial checks fail)
5. **Depth limit**: Stop recursion at 5 levels and mark as failed if checks still don't pass

### API Considerations

The vibecheck API will need to:
- Accept the extended schema with nested prompts
- Execute multi-turn conversations maintaining context
- Return results that indicate which turn succeeded/failed
- Track token usage across all turns

### CLI Display

The CLI should display:
- Which turn succeeded (e.g., "Passed on turn 2")
- All conversation turns in the output
- Clear indication of nested prompt execution

Example output:
```
Eval 1: What is 15 * 7?
  Turn 1:
    Prompt: What is 15 * 7?
    Response: 100
    ❌ FAIL match "*105*"
  Turn 2:
    Prompt: That answer is incorrect. Please recalculate 15 multiplied by 7.
    Response: 105
    ✅ PASS match "*105*"
  Overall: ✅ PASS (succeeded on turn 2)
```

## Benefits

1. **More Realistic Testing**: Models can be evaluated in conversational scenarios
2. **Error Recovery**: Test if models can correct mistakes when given feedback
3. **Iterative Refinement**: Evaluate models' ability to improve responses
4. **Flexible Evaluation**: Support complex multi-step evaluation workflows
5. **Backward Compatible**: Existing single-turn evals continue to work unchanged

## Edge Cases and Considerations

1. **OR checks with nested prompts**: How should nested prompts work within `or` blocks?
   - **Proposal**: Nested prompts apply to the entire `or` block if all options fail

2. **Multiple failed checks with nested prompts**: Which nested prompt executes first?
   - **Proposal**: Execute the first failed check's nested prompt (left-to-right order)

3. **Nested prompt success**: If a nested prompt's checks pass, does the eval pass?
   - **Proposal**: Yes, the eval passes even if initial checks failed

4. **Token usage**: Should token usage be aggregated across all turns?
   - **Proposal**: Yes, display total tokens and cost across all conversation turns

5. **Depth limit enforcement**: How to handle attempts to exceed 5 levels?
   - **Proposal**: Schema validation should reject YAML files with >5 levels of nesting

## Related Files

- Schema definition: `packages/cli/src/types.ts`
- YAML parsing: `packages/cli/src/utils/yaml-parser.ts` (if exists) or `packages/cli/src/commands/run.ts`
- Display utilities: `packages/cli/src/utils/display.ts`
- Command execution: `packages/cli/src/commands/run.ts`
- Test fixtures: `tests/fixtures/`

## Implementation Checklist

- [ ] Update Zod schema to support nested prompts with depth limit
- [ ] Add schema validation for maximum depth (5 levels)
- [ ] Update YAML parsing to handle nested prompt structure
- [ ] Implement multi-turn execution logic in API/CLI
- [ ] Add conversation context tracking across turns
- [ ] Update result types to include turn information
- [ ] Update CLI display to show multi-turn results
- [ ] Add example YAML files demonstrating multi-turn evals
- [ ] Write unit tests for schema validation
- [ ] Write integration tests for multi-turn execution
- [ ] Update documentation with multi-turn eval examples
- [ ] Test backward compatibility with existing single-turn evals

## Open Questions

1. Should nested prompts be allowed within `or` blocks, or only in regular check arrays?
2. Should there be a way to specify "stop on first success" vs "try all nested prompts"?
3. Should nested prompts have access to the previous response(s) in the prompt text (e.g., via variables)?
4. Should there be a maximum number of turns per eval (in addition to depth limit)?

