# Add support for user defined scoring

## Summary

The current scoring approach is limiting and not intuitive to many users. This feature allows users to define custom scoring equations in their eval YAML files, enabling more sophisticated evaluation metrics that can incorporate multiple factors like success rates, costs, latency, and individual eval results.

## Problem

Currently, vibecheck uses a simple success percentage as the default scoring metric. This one-dimensional approach doesn't account for:
- Cost efficiency (high success rate but expensive)
- Latency considerations (fast vs slow responses)
- Weighted importance of different evals
- Complex business metrics that combine multiple factors

Users need the flexibility to define their own scoring formulas that reflect their specific evaluation priorities and business requirements.

## Solution

Allow users to define a scoring equation in their eval YAML files. The scoring system will:

1. Support referencing individual eval results by name
2. Expose run-wide metrics (protected keywords)
3. Enable mathematical expressions combining these values
4. Default to `success_pct` if no custom score is defined
5. Validate scoring formulas client-side
6. Calculate and store scores server-side

## Approach

### YAML Format Changes

Add a new section at the bottom of the YAML for scoring configuration:

```yaml
metadata:
  name: my-eval-suite
  model: anthropic/claude-3.5-sonnet

evals:
  - name: math-question
    prompt: What is 2 + 2?
    checks:
      - match: "*4*"
  
  - name: translation-test
    prompt: Translate "hello" to Spanish
    checks:
      - match: "*hola*"

score:
  formula: success_pct / total_cost
```

### Eval Naming

Add a new optional `name` property to each eval section to allow referencing individual eval results in the scoring formula:

```yaml
evals:
  - name: critical-eval
    prompt: Important question
    checks:
      - match: "*expected*"
  
  - name: secondary-eval
    prompt: Less important question
    checks:
      - match: "*expected*"
```

### Protected Keywords (Run-wide Metrics)

The following keywords are reserved and cannot be used as eval names. These represent run-wide metrics available in scoring formulas:

- `max_latency` - Maximum latency across all evals
- `min_latency` - Minimum latency across all evals
- `avg_latency` - Average latency across all evals
- `total_latency` - Sum of all eval latencies
- `max_cost` - Maximum cost across all evals
- `min_cost` - Minimum cost across all evals
- `avg_cost` - Average cost across all evals
- `total_cost` - Sum of all eval costs
- `success_pct` - Overall success percentage (0-100)

### Eval Result References

Individual eval results can be referenced by their `name` property in the scoring formula. Each named eval exposes:
- `{eval_name}` - Success status (1 for pass, 0 for fail)
- `{eval_name}_latency` - Latency for that specific eval
- `{eval_name}_cost` - Cost for that specific eval

### Scoring Formula Syntax

The scoring formula supports basic mathematical operations:
- Arithmetic: `+`, `-`, `*`, `/`
- Parentheses for grouping: `()`
- Numeric literals
- Variable references (eval names and protected keywords)

**Example formulas:**
```yaml
score:
  formula: success_pct / total_cost  # Cost efficiency

score:
  formula: (critical-eval * 2 + secondary-eval) / avg_latency  # Weighted with latency

score:
  formula: success_pct * 0.7 - (total_cost * 100)  # Success weighted, cost penalized
```

### Default Scoring

If no `score` section is provided, the default formula is:
```yaml
score:
  formula: success_pct
```

This maintains backward compatibility with existing eval files.

## Examples

### Example 1: Simple Cost Efficiency

```yaml
metadata:
  name: cost-efficient-eval
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: What is 2 + 2?
    checks:
      - match: "*4*"
  
  - prompt: What is 3 + 3?
    checks:
      - match: "*6*"

score:
  formula: success_pct / total_cost
```

This scores runs based on success rate divided by total cost, prioritizing cost-efficient evaluations.

### Example 2: Weighted Evals with Cost Consideration

```yaml
metadata:
  name: weighted-cost-eval
  model: anthropic/claude-3.5-sonnet

evals:
  - name: critical-math
    prompt: What is 15 * 7?
    checks:
      - match: "*105*"
  
  - name: important-translation
    prompt: Translate "hello" to Spanish
    checks:
      - match: "*hola*"
  
  - name: secondary-question
    prompt: What color is the sky?
    checks:
      - match: "*blue*"

score:
  formula: (critical-math * 3 + important-translation * 2 + secondary-question) / total_cost
```

This formula:
- Weights `critical-math` at 3x importance
- Weights `important-translation` at 2x importance
- Weights `secondary-question` at 1x importance
- Divides by total cost to factor in cost efficiency

### Example 3: Complex Multi-Factor Scoring

```yaml
metadata:
  name: comprehensive-scoring
  model: anthropic/claude-3.5-sonnet

evals:
  - name: accuracy-test
    prompt: Solve: 2x + 5 = 15
    checks:
      - match: "*5*"
  
  - name: speed-test
    prompt: Quick response test
    checks:
      - match: "*response*"
      - max_tokens: 50

score:
  formula: (accuracy-test * 0.6 + speed-test * 0.4) * success_pct / (avg_latency * total_cost)
```

This formula:
- Combines weighted eval results (60% accuracy, 40% speed)
- Multiplies by overall success percentage
- Penalizes for high latency and cost

## Technical Implementation

### Client-Side Validation

The CLI must validate scoring formulas before sending to the API:

1. **Syntax validation**: Ensure formula is valid mathematical expression
2. **Variable validation**: 
   - Verify all referenced eval names exist in the `evals` section
   - Verify no eval names conflict with protected keywords
   - Verify eval names are valid identifiers (alphanumeric, hyphens, underscores)
3. **Type checking**: Ensure operations are valid (e.g., no division by zero in static analysis)
4. **Error messages**: Provide clear, actionable error messages for invalid formulas

**Validation errors should include:**
- Unknown variable references
- Reserved keyword conflicts
- Invalid mathematical syntax
- Missing eval names in formula references

### Server-Side Calculation

The vibecheck API will:
1. Parse and validate the scoring formula (re-validate server-side for security)
2. Calculate all run-wide metrics (latency, cost aggregations)
3. Evaluate individual eval results
4. Substitute values into the formula
5. Calculate final score
6. Store score with the run results

### Schema Changes

**YAML Schema Updates:**

```typescript
// Add name to eval schema
const EvalSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(), // Valid identifier, not reserved
  prompt: z.string(),
  checks: ChecksSchema
});

// Add score section to metadata or top-level
const ScoreSchema = z.object({
  formula: z.string().min(1) // Mathematical expression
});

const EvalSuiteSchema = z.object({
  metadata: MetadataSchema,
  evals: z.array(EvalSchema).min(1),
  score: ScoreSchema.optional() // Optional, defaults to success_pct
});
```

**Protected Keywords List:**
```typescript
const PROTECTED_KEYWORDS = [
  'max_latency', 'min_latency', 'avg_latency', 'total_latency',
  'max_cost', 'min_cost', 'avg_cost', 'total_cost',
  'success_pct'
];
```

### API Response Changes

The API should include the calculated score in run responses:

```typescript
{
  run: {
    // ... existing fields ...
    score: number; // Calculated custom score
    score_formula: string; // Formula used (if custom)
    // ... other fields ...
  }
}
```

### CLI Display

The CLI should display custom scores when available:

```
=== Run Summary ===
Score: 45.23 (formula: success_pct / total_cost)
Success Rate: 80.0%
Total Cost: $0.0177
...
```

## Benefits

1. **Flexibility**: Users can define scoring that matches their business needs
2. **Cost Awareness**: Factor cost efficiency into evaluations
3. **Performance Metrics**: Consider latency in scoring
4. **Weighted Importance**: Prioritize critical evals over secondary ones
5. **Backward Compatible**: Default behavior unchanged for existing evals
6. **Transparency**: Clear formula and calculated values

## Edge Cases and Considerations

1. **Missing eval names**: If formula references an eval name that doesn't exist, validation should fail
2. **Reserved keyword conflicts**: Eval names cannot match protected keywords (validation error)
3. **Division by zero**: Server should handle gracefully (return 0 or error)
4. **Invalid formula syntax**: Clear error messages for malformed formulas
5. **Empty evals**: If no evals pass, some metrics may be undefined (handle gracefully)
6. **Formula complexity**: Should there be a limit on formula length/complexity?
7. **Eval name uniqueness**: Eval names must be unique within a suite (validation)

## Related Files

- Schema definition: `packages/shared/src/types.ts`
- YAML parsing: `packages/cli/src/utils/yaml-parser.ts`
- Validation: `packages/cli/src/utils/yaml-parser.ts`
- Display utilities: `packages/cli/src/utils/display.ts`
- API endpoints: `/api/runs` (vibeserver)

## Implementation Checklist

- [ ] Update shared types to include `name` property in eval schema
- [ ] Update shared types to include `score` section in suite schema
- [ ] Add protected keywords constant and validation
- [ ] Implement client-side formula validation (syntax, variables, reserved words)
- [ ] Update YAML parser to handle new fields
- [ ] Add formula parsing/evaluation library or custom parser
- [ ] Update API to calculate and store custom scores
- [ ] Add score and score_formula to API responses
- [ ] Update CLI display to show custom scores
- [ ] Add example YAML files with custom scoring
- [ ] Write unit tests for formula validation
- [ ] Write unit tests for eval name validation
- [ ] Write integration tests for scoring calculation
- [ ] Update documentation with scoring examples
- [ ] Test backward compatibility (evals without score section)

## Open Questions

1. Should formulas support more advanced functions (e.g., `sqrt()`, `log()`, `max()`, `min()`)?
2. Should there be a formula complexity limit (length, nesting depth)?
3. Should eval names be required if score formula references them, or optional?
4. Should the CLI display the formula breakdown (showing substituted values)?
5. Should there be validation for reasonable score ranges, or allow any numeric result?

