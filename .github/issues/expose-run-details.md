# Expose Missing Run Details in API and CLI

## Summary

Currently, some run details are not fully exposed to users in the API responses and CLI output. Specifically:
- **Thinking tokens** are not tracked or displayed (for models like Claude that support them)
- **Pricing breakdowns** are missing - only `total_cost` is shown, not input/output cost breakdown
- **Token aggregations** - per-eval token counts exist but aren't aggregated at run level
- **Per-eval costs** - individual eval costs exist in database but aren't shown in CLI

## Current Behavior

### API (vibeserver)

The API currently returns:
- `total_cost` for runs in list and detail views
- `prompt_tokens`, `completion_tokens`, `total_tokens` per eval result in run detail
- `cost` per eval result in run detail

**Missing from API responses:**
- Thinking tokens tracking and aggregation
- Cost breakdowns (input cost vs output cost)
- Aggregated token counts at run level (`total_prompt_tokens`, `total_completion_tokens`, `total_thinking_tokens`)
- Cost breakdowns at run level (`total_input_cost`, `total_output_cost`)

### CLI (vibecheck)

The CLI currently displays:
- `total_cost` in run list (`vibe get runs`) and detail view (`vibe get runs <id>`)
- Token counts only visible in individual eval results (not aggregated)

**Missing from CLI display:**
- Thinking tokens display
- Cost breakdowns (input vs output)
- Per-eval costs in results section
- Aggregated token counts at run level
- Formatted token numbers (e.g., "1,234 tokens" instead of "1234")

## Desired Behavior

### API Enhancements

1. **Add thinking tokens support:**
   - Track `thinking_tokens` per eval result in database
   - Aggregate `total_thinking_tokens` at run level
   - Return in API responses

2. **Add cost breakdown fields:**
   - Calculate `input_cost` and `output_cost` per eval result
   - Aggregate `total_input_cost` and `total_output_cost` at run level
   - Return in API responses

3. **Enhance API responses:**
   - Run list: Include `total_prompt_tokens`, `total_completion_tokens`, `total_thinking_tokens`, `total_tokens`
   - Run detail: Include cost breakdowns (`total_input_cost`, `total_output_cost`, `total_cost`)
   - Run detail: Ensure per-eval costs are included in results

### CLI Enhancements

1. **Run list display (`vibe get runs`):**
   - Optionally show token counts (behind flag or in detailed view)
   - Show cost breakdown if available

2. **Run detail display (`vibe get runs <id>`):**
   - Show aggregated token counts: Input, Output, Thinking (if available), Total
   - Show cost breakdown: Input Cost, Output Cost, Total Cost
   - Show per-eval costs in results section
   - Format large numbers with commas (e.g., "1,234 tokens")

3. **CSV export:**
   - Add token count columns: `total_prompt_tokens`, `total_completion_tokens`, `total_thinking_tokens`
   - Add cost breakdown columns: `total_input_cost`, `total_output_cost`

## Example Output

### Enhanced Run Detail View (`vibe get runs <id>`)

```
=== Run Details ===

ID:           550e8400-e29b-41d4-a716-446655440000
Suite Name:   hello-world
Model:        anthropic/claude-3.5-sonnet
Status:       completed
Started:      1/15/2024, 10:30:00 AM
Completed:    1/15/2024, 10:32:15 AM
Duration:     135.23s
Results:      5/5 passed (100.0%)

Token Usage:
  Input tokens:    12,345
  Output tokens:   1,234
  Thinking tokens:   567 (if available)
  Total tokens:    14,146

Cost Breakdown:
  Input cost:      $0.037035
  Output cost:     $0.018510
  Total cost:      $0.055545

=== Evaluation Results ===

Eval 1: What is 2 + 2?
  Prompt: What is 2 + 2?
  Response: 4
  Cost: $0.001234
  Tokens: 10 input, 2 output, 0 thinking
  ✅ PASS string_contains contains "4"
  Overall: ✅ PASS

...
```

### Enhanced CSV Export

```csv
id,suite_name,model,status,...,total_prompt_tokens,total_completion_tokens,total_thinking_tokens,total_input_cost,total_output_cost,total_cost
550e8400-...,hello-world,anthropic/claude-3.5-sonnet,completed,...,12345,1234,567,0.037035,0.018510,0.055545
```

## Technical Notes

### Database Schema (vibeserver)

Current schema includes:
- `eval_results.prompt_tokens`, `completion_tokens`, `total_tokens`
- `eval_results.cost`
- `eval_runs.total_cost`

**Required additions:**
- `eval_results.thinking_tokens` (INTEGER DEFAULT 0)
- `eval_results.input_cost` (DECIMAL(12, 6))
- `eval_results.output_cost` (DECIMAL(12, 6))

**Aggregations needed:**
- Run-level: SUM of tokens and costs from eval_results

### API Response Structure

**Run list response should include:**
```typescript
{
  runs: [{
    // ... existing fields ...
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_thinking_tokens: number | null; // null if not available
    total_tokens: number;
    total_input_cost: number | null;
    total_output_cost: number | null;
    total_cost: number | null;
  }]
}
```

**Run detail response should include:**
```typescript
{
  run: {
    // ... existing fields ...
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_thinking_tokens: number | null;
    total_tokens: number;
    total_input_cost: number | null;
    total_output_cost: number | null;
    total_cost: number | null;
    results: [{
      // ... existing fields ...
      prompt_tokens: number;
      completion_tokens: number;
      thinking_tokens: number | null;
      total_tokens: number;
      input_cost: number | null;
      output_cost: number | null;
      cost: number | null;
    }]
  }
}
```

### CLI Implementation

**Helper functions needed:**
- `formatTokenCount(count: number): string` - Format with commas
- `formatCostBreakdown(input: number | null, output: number | null, total: number | null): string` - Format cost breakdown

**Backward compatibility:**
- All new fields should be optional/nullable
- CLI should gracefully handle missing fields (show "N/A" or omit)
- Existing functionality should remain unchanged

## Benefits

1. **Cost Transparency**: Users can see exactly where costs come from (input vs output)
2. **Token Visibility**: Users can understand token usage patterns across runs
3. **Thinking Token Tracking**: Important for models like Claude that use thinking tokens
4. **Better Analysis**: Enables users to optimize evaluations based on token usage and costs
5. **Complete Information**: Makes all available data accessible to users

## Related

- Current implementation: `packages/cli/src/commands/runs.ts`
- API endpoints: `/api/runs`, `/api/runs/:runId`
- Database operations: `packages/api/src/db/runOperations.ts` (vibeserver)
- OpenRouter service: `packages/api/src/services/openrouter.ts` (vibeserver)

## Implementation Status

- [ ] API: Add thinking tokens tracking
- [ ] API: Add cost breakdown calculations
- [ ] API: Add aggregated token/cost fields to responses
- [ ] CLI: Update run list display
- [ ] CLI: Update run detail display
- [ ] CLI: Update CSV export
- [ ] CLI: Add formatting helpers
- [ ] Testing: Verify with thinking token models
- [ ] Testing: Verify backward compatibility

