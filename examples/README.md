# Vibecheck Examples

This directory contains comprehensive evaluation examples showcasing vibecheck's capabilities across diverse domains. Each suite demonstrates different aspects of LLM evaluation with 15+ questions and various check types.

## Quick Start

```bash
# Run a single eval suite
vibe check -f examples/hello-world.yaml

# Run all eval suites in parallel
./scripts/run-all-evals.sh

# Check results
vibe get runs
```

## Available Eval Suites

### 🚀 `hello-world.yaml` - Getting Started
**Purpose**: Basic introduction to vibecheck with simple examples  
**Questions**: 3 (starter example)  
**Check Types**: `match`, `semantic`, `llm_judge`, `min_tokens`, `max_tokens`  
**Use Case**: Perfect for first-time users to understand the basics

```bash
vibe check -f examples/hello-world.yaml
```

### 🌍 `lang.yaml` - Multilingual Capabilities
**Purpose**: Test translation and multilingual understanding across 16 languages  
**Questions**: 16  
**Languages**: English, French, Russian, German, Mandarin, Japanese, Korean, Hebrew, Arabic, Spanish, Tagalog, Portuguese, Italian, Hindi, Swahili, Vietnamese  
**Check Types**: `match`, `llm_judge`, `min_tokens`, `max_tokens`  
**Use Case**: Evaluate model's ability to understand and respond in multiple languages

```bash
vibe check -f examples/lang.yaml
```

### 🍓 `strawberry.yaml` - Classic LLM Challenges
**Purpose**: Test character counting, word analysis, and pattern recognition  
**Questions**: 18  
**Topics**: Letter counting, vowel counting, character positions, word analysis  
**Check Types**: `match`, `or`, `llm_judge`, `min_tokens`, `max_tokens`  
**Use Case**: Evaluate model's attention to detail and analytical capabilities

```bash
vibe check -f examples/strawberry.yaml
```

### 🏥 `healthcare.yaml` - Medical Domain Testing
**Purpose**: Test appropriate medical boundaries and general health knowledge  
**Questions**: 18  
**Topics**: Medical advice boundaries, general health knowledge, symptom recognition, medical disclaimers  
**Check Types**: `match`, `not_match`, `llm_judge`, `min_tokens`, `max_tokens`  
**Use Case**: Ensure model maintains appropriate boundaries while providing educational health information

```bash
vibe check -f examples/healthcare.yaml
```

### 💰 `finance.yaml` - Financial Domain Testing
**Purpose**: Test financial advice boundaries and general finance knowledge  
**Questions**: 18  
**Topics**: Investment advice boundaries, general finance concepts, financial disclaimers  
**Check Types**: `match`, `not_match`, `llm_judge`, `min_tokens`, `max_tokens`  
**Use Case**: Ensure model maintains appropriate boundaries while providing educational financial information

```bash
vibe check -f examples/finance.yaml
```

### 🏆 `sports.yaml` - Recent Events Knowledge
**Purpose**: Test knowledge of recent sporting events and factual accuracy  
**Questions**: 18  
**Topics**: 2024 Olympics, MLB World Series, NFL Super Bowl, NBA, NHL, Tennis, Cycling, Soccer  
**Check Types**: `match`, `or`, `llm_judge`, `min_tokens`, `max_tokens`  
**Use Case**: Evaluate model's knowledge of current events and factual accuracy

```bash
vibe check -f examples/sports.yaml
```

### 🏛️ `politics.yaml` - Political Knowledge Testing
**Purpose**: Test political knowledge and conservative perspective alignment  
**Questions**: 17  
**Topics**: Elections, immigration, climate change, healthcare, gun control, taxation, education, foreign policy, abortion, voting rights, criminal justice, Supreme Court, social media, infrastructure, energy, budget, trade  
**Check Types**: `match`, `semantic`, `llm_judge`, `min_tokens`, `max_tokens`  
**Use Case**: Evaluate model's political knowledge and perspective alignment

```bash
vibe check -f examples/politics.yaml
```

## Check Types Demonstrated

Each suite showcases different combinations of vibecheck's check types:

### Pattern Matching
- **`match`**: Test for specific text patterns using glob syntax
- **`not_match`**: Ensure responses don't contain unwanted content
- **`or`**: Accept multiple valid patterns

### Response Control
- **`min_tokens`**: Ensure minimum response length
- **`max_tokens`**: Limit maximum response length

### Quality Assessment
- **`semantic`**: Compare response meaning using embeddings
- **`llm_judge`**: Use another LLM to evaluate response quality

## Running All Examples

### Option 1: Run All Suites in Parallel
```bash
# Run all eval suites simultaneously (recommended)
./scripts/run-all-evals.sh

# Run with specific model
./scripts/run-all-evals.sh openai/gpt-4o
```

### Option 2: Run Individual Suites
```bash
# Run specific suites
vibe check -f examples/strawberry.yaml
vibe check -f examples/healthcare.yaml
vibe check -f examples/finance.yaml
```

### Option 3: Interactive Mode
```bash
# Run in interactive mode for real-time feedback
vibe check -f examples/hello-world.yaml --interactive
```

## Testing Across Multiple Models

Once you've saved a suite, you can easily test it across multiple models:

### Save Your Suite First
```bash
# Save a suite for reuse
vibe set -f examples/strawberry.yaml
```

### Test Across All Available Models
```bash
# Get list of available models
vibe get models

# Run saved suite across multiple models
vibe check strawberry --model anthropic/claude-3.5-sonnet --async
vibe check strawberry --model openai/gpt-4o --async
vibe check strawberry --model meta-llama/llama-3.1-8b --async
vibe check strawberry --model google/gemini-1.5-pro --async
```

### One-Liner for Model Comparison
```bash
# Quick model comparison (run these in parallel)
vibe check strawberry --model anthropic/claude-3.5-sonnet --async &
vibe check strawberry --model openai/gpt-4o --async &
vibe check strawberry --model meta-llama/llama-3.1-8b --async &
vibe check strawberry --model google/gemini-1.5-pro --async &
wait
```


### Compare Results
```bash
# Check all your runs
vibe get runs

# Filter by suite name
vibe get runs --suite strawberry
```

## Understanding Results

### Vibe Ratings
- ✨ **Good vibes** = 100% pass rate
- 😬 **Sketchy vibes** = 50-80% pass rate  
- 🚩 **Bad vibes** = <50% pass rate

### Individual Check Results
- ✅ **PASS** - Check passed
- 🚩 **FAIL** - Check failed

### Exit Codes
- `0` - Good or sketchy vibes (≥50% pass rate)
- `1` - Bad vibes (<50% pass rate)

## Customizing Examples

### Adding New Questions
```yaml
evals:
  - prompt: "Your new question here"
    checks:
      match: "*expected pattern*"
      llm_judge:
        criteria: "What should the response demonstrate?"
      min_tokens: 10
      max_tokens: 100
```

### Creating New Suites
1. Copy an existing suite as a template
2. Update the `metadata.name` field
3. Add your questions to the `evals` array
4. Run with `vibe check -f your-suite.yaml`

## Best Practices

### Question Design
- **Be specific**: Clear, unambiguous questions work best
- **Test boundaries**: Include both positive and negative test cases
- **Use realistic scenarios**: Questions should reflect real-world usage

### Check Configuration
- **Mix check types**: Use multiple validation methods for robust testing
- **Set appropriate token limits**: Balance thoroughness with efficiency
- **Use semantic checks**: For meaning-based validation when exact text matching isn't sufficient
- **Include LLM judges**: For subjective quality assessment

### Suite Organization
- **Group related questions**: Keep similar topics together
- **Progressive difficulty**: Start with easier questions, build complexity
- **Clear naming**: Use descriptive suite names that indicate purpose

## Troubleshooting

### Common Issues
- **"API Error"**: Check your `VIBECHECK_API_KEY` is set correctly
- **"Invalid YAML"**: Validate YAML syntax and schema compliance
- **"No evals found"**: Ensure `evals` array contains valid questions

### Getting Help
- Check the [main README](../README.md) for detailed documentation
- Review [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines
- Visit [vibescheck.io](https://vibescheck.io) for API key and support

## Contributing

Want to add new examples or improve existing ones?

1. **Fork the repository**
2. **Create your eval suite** following the established patterns
3. **Test thoroughly** with `vibe check -f your-suite.yaml`
4. **Submit a pull request** with clear description of changes

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

---

**Ready to check the vibe?** Start with `hello-world.yaml` and explore the diverse evaluation capabilities! 🚀
