# View Detailed Model Information from CLI

## Summary

Currently, `vibe get models` displays a table with model ID, description, MCP support, and price tier ($, $$, $$$, $$$$). The API response includes detailed pricing information (token costs for prompt, completion, request, and image), but this data is not displayed to users.

## Current Behavior

The `vibe get models` command shows:
- Model ID
- Description
- MCP support (yes/no)
- Price tier ($, $$, $$$, $$$$)

The pricing information is calculated from the API response but only shown as a relative tier indicator.

## Desired Behavior

Users should be able to view detailed model information including:
- **Token costs**: Exact pricing per token for prompt, completion, request, and image tokens
- **Supported parameters**: Full list of supported parameters (currently only checked for MCP support)
- **Additional metadata**: Any other model-specific information available from the API

## Proposed Implementation

### Option 1: Detailed View Command
Add a new command to view detailed information for a specific model:
```bash
vibe get model <model-id>
```

This would display:
- Model ID
- Name
- Description
- Full pricing breakdown:
  - Prompt tokens: $X.XX per 1M tokens
  - Completion tokens: $X.XX per 1M tokens
  - Request tokens: $X.XX per request (if applicable)
  - Image tokens: $X.XX per image (if applicable)
- Supported parameters list
- Any other available metadata

### Option 2: Enhanced List with Details Flag
Add a `--detailed` or `--verbose` flag to the existing command:
```bash
vibe get models --detailed
vibe get models -v
```

This would show the detailed pricing information in the table or as an expanded view.

### Option 3: Hybrid Approach
- Default: Keep current table view
- `vibe get model <model-id>`: Show detailed view for a specific model
- `vibe get models --detailed`: Show detailed pricing in the list view

## Example Output

### Detailed Model View (`vibe get model anthropic/claude-3.5-sonnet`)

```
Model: anthropic/claude-3.5-sonnet
Name: Claude 3.5 Sonnet
Description: Anthropic's Claude 3.5 Sonnet model

Pricing:
  Prompt tokens:    $3.00 per 1M tokens
  Completion tokens: $15.00 per 1M tokens
  Request tokens:     $0.00 per request

Supported Parameters:
  - temperature
  - max_tokens
  - top_p
  - tools (MCP support)

Provider: anthropic
```

### Enhanced List View (`vibe get models --detailed`)

```
Models (15)

ID                                      Description                    MCP    Prompt      Completion
--------------------------------------------------------------------------------------------------------
anthropic/claude-3.5-sonnet            Claude 3.5 Sonnet              yes    $3.00/1M    $15.00/1M
openai/gpt-4-turbo                      GPT-4 Turbo                   yes    $10.00/1M   $30.00/1M
...
```

## Technical Notes

- The API already returns detailed pricing in the `pricing` object:
  ```typescript
  interface ModelPricing {
    prompt: string;      // e.g., "3.00"
    completion: string;  // e.g., "15.00"
    request?: string;    // e.g., "0.00"
    image?: string;      // e.g., "0.00"
  }
  ```
- The `supported_parameters` array is available but currently only checked for `tools`
- Implementation should follow the existing CLI patterns and display utilities

## Benefits

1. **Cost Transparency**: Users can see exact token costs to estimate evaluation expenses
2. **Model Comparison**: Easier to compare models based on pricing and capabilities
3. **Better Decision Making**: Users can make informed choices about which models to use
4. **API Utilization**: Makes better use of the detailed data already available from the API

## Related

- Current implementation: `packages/cli/src/commands/models.ts`
- API endpoint: `/api/models`
- Model info interface: `ModelInfo` and `ModelPricing` types

