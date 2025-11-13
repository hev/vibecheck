# Model Comparison & Scoring

Learn how to compare models and understand vibecheck's scoring system.

## Table of Contents

- [Score Calculation](#score-calculation)
- [Score Color Coding](#score-color-coding)
- [Multi-Model Comparison](#multi-model-comparison)
- [Sorting Options](#sorting-options)
- [Success Rates](#success-rates)

## Score Calculation

The **Score** column in `vibe get runs` combines three key factors to help you compare models:

```
Score = success_percentage / (cost * 1000 + duration_seconds * 0.1)
```

### Components

- **Success Rate**: Percentage of evaluations that passed
- **Cost Factor**: Total cost in dollars (multiplied by 1000 for scaling)
- **Latency Factor**: Duration in seconds (multiplied by 0.1 for small penalty)

**Higher scores indicate better overall performance** - more accurate, cheaper, and faster.

### Understanding the Formula

The score formula balances three dimensions:

1. **Accuracy** (success_percentage): Higher is better
2. **Cost** (cost * 1000): Lower cost = higher score
3. **Speed** (duration_seconds * 0.1): Faster = higher score

The cost factor (1000x) has more weight than latency (0.1x), reflecting that accuracy and cost are typically more important than speed in evaluation scenarios.

## Score Color Coding

Scores are color-coded for quick visual assessment:

- 🟢 **Green (≥1.0)**: Excellent performance
- 🟡 **Yellow (0.3-1.0)**: Good performance
- 🔴 **Red (<0.3)**: Poor performance
- ⚪ **Gray (N/A)**: Cannot calculate (incomplete runs or missing cost data)

**Note**: Scores are only calculated for completed runs to ensure fair cost comparisons. Incomplete runs show "N/A" to avoid skewing results with partial token processing.

## Multi-Model Comparison

Run evaluations on multiple models using flexible selection patterns.

### Comma-Delimited Models

Run on specific models:

```bash
# Run on specific models
vibe check -f my-eval.yaml -m "anthropic/claude-3.5-sonnet,openai/gpt-4"

# Mix and match any combination
vibe check -f my-eval.yaml -m "openai/gpt-4,anthropic/claude-3.5-sonnet,google/gemini-pro"
```

### Wildcard Selection

Use wildcards to select all models from a provider:

```bash
# Run on all OpenAI models
vibe check -f my-eval.yaml -m "openai*"

# Run on multiple providers
vibe check -f my-eval.yaml -m "openai*,anthropic*"

# Mix wildcards and specific models
vibe check -f my-eval.yaml -m "openai*,anthropic/claude-3.5-sonnet"
```

### Select All Models

Run on all available models:

```bash
# Run on all available models
vibe check -f my-eval.yaml -m all
```

### Filter by Criteria

Combine selection with filters to narrow down:

```bash
# All $ models with MCP support
vibe check -f my-eval.yaml -m all --price 1 --mcp

# All OpenAI models in the cheapest quartile
vibe check -f my-eval.yaml -m openai* --price 1

# All Anthropic and Google models with MCP
vibe check -f my-eval.yaml -m "anthropic*,google*" --mcp
```

### Price Quartiles

Models are grouped into price quartiles (1-4):

- **Quartile 1**: Cheapest 25% of models
- **Quartile 2**: 25-50% price range
- **Quartile 3**: 50-75% price range
- **Quartile 4**: Most expensive 25% of models

```bash
# View models by price quartile
vibe get models --price 1        # Cheapest models
vibe get models --price 1,2      # Budget-friendly models
vibe get models --price 4        # Premium models
```

### View Results

After running multi-model comparisons, view results sorted by score:

```bash
vibe get runs --sort-by price-performance
```

## Sorting Options

Sort runs by different criteria to analyze results:

```bash
# Sort by creation time (default)
vibe get runs --sort-by created

# Sort by success rate
vibe get runs --sort-by success

# Sort by total cost
vibe get runs --sort-by cost

# Sort by duration
vibe get runs --sort-by time

# Sort by score (recommended for comparisons)
vibe get runs --sort-by price-performance
```

### When to Use Each Sort

- **`created`**: Chronological view of all runs
- **`success`**: Find the most accurate models
- **`cost`**: Find the most economical models
- **`time`**: Find the fastest models
- **`price-performance`**: Best overall balance (recommended)

## Success Rates

Success rates are displayed as percentages with color coding.

### Color Coding

- **Green** (>80% pass rate): High success rate
- **Yellow** (50-80% pass rate): Moderate success rate
- **Red** (<50% pass rate): Low success rate

### Individual Check Results

- ✅ **PASS**: Check passed
- ❌ **FAIL**: Check failed

### Exit Codes

When running `vibe check`, the CLI exits with:

- `0`: Moderate or high success rate (≥50% pass rate)
- `1`: Low success rate (<50% pass rate)

This allows you to use vibecheck in CI/CD pipelines with failure thresholds.

### Example Output

```bash
vibe check -f my-eval.yaml
```

**Output:**
```
hello-world  ----|+++++  ✅ in 2.3s

hello-world: Success Pct: 2/2 (100.0%)
```

Where:
- `-` = failed conditional
- `+` = passed conditional

## Filtering Runs

Filter runs by various criteria:

```bash
# Filter by suite name
vibe get runs --suite my-eval-suite

# Filter by status
vibe get runs --status completed
vibe get runs --status running

# Filter by success rate
vibe get runs --success-gt 80        # Success rate > 80%
vibe get runs --success-lt 50        # Success rate < 50%

# Filter by duration
vibe get runs --time-lt 60           # Duration < 60 seconds
vibe get runs --time-gt 120          # Duration > 120 seconds

# Combine filters
vibe get runs --suite my-eval --status completed --success-gt 90
```

## Pagination

Control result pagination:

```bash
# Limit results
vibe get runs --limit 10

# Paginate through results
vibe get runs --limit 10 --offset 0    # First page
vibe get runs --limit 10 --offset 10   # Second page
vibe get runs --limit 10 --offset 20   # Third page
```

---

[← Back to README](../README.md) | [CLI Reference](./cli-reference.md)
