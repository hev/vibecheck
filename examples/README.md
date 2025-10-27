# Vibecheck Examples

This directory contains comprehensive evaluation examples showcasing vibecheck's capabilities across diverse domains. Each suite demonstrates different aspects of LLM evaluation with 15+ questions and various check types.

## Quick Start

```bash
# Run a single eval suite
vibe check -f examples/hello-world.yaml

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

```bash
# Run specific suites
vibe check -f examples/strawberry.yaml
vibe check -f examples/healthcare.yaml
vibe check -f examples/finance.yaml
```

## Testing Across Multiple Models

You can test evaluations across multiple models directly from the command line by specifying comma-separated model IDs:

### With a YAML File
```bash
# Run the same eval on multiple models (runs in async mode)
vibe check -f examples/strawberry.yaml --model anthropic/claude-3.5-sonnet,openai/gpt-4o,meta-llama/llama-3-8b-instruct,google/gemini-2.5-pro
```

### With a Saved Suite
First, save your suite:
```bash
# Save a suite for reuse
vibe set -f examples/strawberry.yaml
```

Then run on multiple models:
```bash
# Run a saved suite on multiple models (runs in async mode)
vibe check strawberry --model anthropic/claude-3.5-sonnet,openai/gpt-4o,meta-llama/llama-3-8b-instruct,google/gemini-2.5-pro
```

### Advanced Options

```bash
# Run on ALL available models
vibe check strawberry --model all

# Run on all models with MCP support
vibe check strawberry --model all --mcp

# Run on all models in price quartiles 1 and 2 (cheapest half)
vibe check strawberry --model all --price 1,2

# Run on all models from specific providers
vibe check strawberry --model all --provider anthropic,openai

# Combine filters: all OpenAI models with MCP support
vibe check strawberry --model openai* --mcp
```

### Compare Results
```bash
# Check all your runs
vibe get runs

# Filter by suite name
vibe get runs --suite strawberry

# Check a specific run
vibe get runs <run-id>
```

