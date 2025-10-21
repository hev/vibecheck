# vibecheck CLI ✨

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/your-org/vibecheck/actions)
[![Coverage](https://img.shields.io/badge/coverage-80%25-green)](https://github.com/your-org/vibecheck)
[![npm version](https://img.shields.io/npm/v/vibecheck-cli)](https://www.npmjs.com/package/vibecheck-cli)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](https://opensource.org/licenses/Apache-2.0)

**An agent evaluation framework for any LLM** - A simple and intuitive YAML based DSL for language evals.

vibecheck makes it easy to evaluate any language model with a simple YAML configuration. Run evals,
save the results, and tweak your system prompts with incredibly tight feedback loop from the command line.

> 🎃 **Get Your Invite** 👻
>
> vibe check is currently being offered as an exclusive invite-only halloween pop up! Read our FAQ and summon your API key at [vibescheck.io](https://vibescheck.io).

## Installation

```bash
npm install -g vibecheck-cli
```

**Get your API key at [vibescheck.io](https://vibescheck.io)**

## Quick Start 

> 💡 Tip: Try the interactive onboarding experience
>
> ```bash
> vibe check --interactive
> ```
>
Create a simple evaluation file:

```yaml
# hello-world.yaml
metadata:
  name: hello-world
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: Say hello
    checks:
      match: "*hello*"
      min_tokens: 1
      max_tokens: 50
```

Run the evaluation:

```bash
vibe check -f hello-world.yaml
```

**Output:**
```
✨ hello-world  ----|+++++  ✅ in 2.3s

hello-world: ✨ good vibes (100% pass rate)
```

## Featured Examples

### 🌍 Multilingual Testing
Test your model across 10+ languages with the same evaluation:

```yaml
# examples/multilingual-pbj.yaml
metadata:
  name: multilingual-pbj
  model: meta-llama/llama-4-maverick
  system_prompt: "You are a translator. Respond both in the language the question is asked as well as English."

evals:
  - prompt: "Describe how to make a peanut butter and jelly sandwich."
    checks:
      match: "*bread*"
      llm_judge:
        criteria: "Does this accurately describe how to make a peanut butter and jelly sandwich in English"
      min_tokens: 20
      max_tokens: 300

  - prompt: "Décrivez comment faire un sandwich au beurre d'arachide et à la confiture."
    checks:
      match: "*pain*"
      llm_judge:
        criteria: "Does this accurately describe how to make a peanut butter and jelly sandwich in French"
      min_tokens: 20
      max_tokens: 300
```

### 🔧 MCP Tool Integration
Validate MCP (Model Context Protocol) tool calling with external services:

```yaml
# examples/mcp-evals.yaml
metadata:
  name: mcp_tool_test
  model: anthropic/claude-3.5-sonnet
  system_prompt: |
    You are an AI assistant with access to external tools.
    Use the available tools to answer questions accurately.
  mcp_server:
    url: "https://your-mcp-server.com"
    name: "your-tool-server"
    authorization_token: "your-token"

evals:
  - prompt: "What's the weather like today?"
    checks:
      match: "*weather*"  # Should use weather tool
      min_tokens: 10
      max_tokens: 200
```

### 🧠 Advanced Evaluation Patterns
Combine multiple check types for comprehensive testing:

```yaml
# examples/hello-world.yaml
evals:
  - prompt: How are you today?
    checks:
      semantic:
        expected: "I'm doing well, thank you for asking"
        threshold: 0.7
      llm_judge:
        criteria: "Is this a friendly and appropriate response to 'How are you today?'"
      min_tokens: 10
      max_tokens: 100

  - prompt: What is 2+2?
    checks:
      or:
        match: "*4*"
        match: "*four*"
      llm_judge:
        criteria: "Is this a correct mathematical answer to 2+2?"
      min_tokens: 1
      max_tokens: 20
```

## YAML Syntax Reference

### Check Types

#### `match` - Glob Pattern Matching
Test if the response contains text matching a glob pattern.

```yaml
checks:
  match: "*hello*"        # Contains "hello" anywhere
  match: "hello*"         # Starts with "hello"
  match: "*world"         # Ends with "world"
  match: ["*yes*", "*ok*"] # Multiple patterns (AND logic)
```

**Examples:**
- `match: "*hello*"` matches "Hello world", "Say hello", "hello there"
- `match: "The answer is*"` matches "The answer is 42" but not "Answer: 42"

#### `not_match` - Negated Patterns
Ensure the response does NOT contain certain text.

```yaml
checks:
  not_match: "*error*"    # Must not contain "error"
  not_match: "*sorry*"    # Must not contain "sorry"
```

#### `or` - Explicit OR Logic
Use when you want ANY of multiple patterns to pass.

```yaml
checks:
  or:                     # At least one must pass
    - match: "*yes*"
    - match: "*affirmative*"
    - match: "*correct*"
```

#### `min_tokens` / `max_tokens` - Token Length Constraints
Control response length using token counting.

```yaml
checks:
  min_tokens: 10          # At least 10 tokens
  max_tokens: 100         # At most 100 tokens
```

#### `semantic` - Semantic Similarity
Compare response meaning using embeddings.

```yaml
checks:
  semantic:
    expected: "I'm doing well, thank you for asking"
    threshold: 0.8        # 0.0 to 1.0 similarity score
```

#### `llm_judge` - LLM-Based Evaluation
Use another LLM to judge response quality.

```yaml
checks:
  llm_judge:
    criteria: "Is this a helpful and accurate response to the question?"
```

### Check Logic

**AND Logic (Implicit)**: Multiple checks at the same level must ALL pass
```yaml
checks:
  match: "*hello*"        # AND
  min_tokens: 5           # AND
  max_tokens: 100         # AND
```

**OR Logic (Explicit)**: Use the `or:` field when you want ANY of the patterns to pass
```yaml
checks:
  or:                     # OR (at least one must pass)
    - match: "*yes*"
    - match: "*affirmative*"
    - match: "*correct*"
```

**Combined Logic**: Mix AND and OR logic
```yaml
checks:
  min_tokens: 10          # AND (must pass)
  or:                     # OR (one of these must pass)
    - match: "*hello*"
    - match: "*hi*"
```

### Metadata Configuration

```yaml
metadata:
  name: my-eval-suite     # Required: Suite name
  model: anthropic/claude-3.5-sonnet  # Required: Model to test
  system_prompt: "You are a helpful assistant"  # Optional: System prompt
  threads: 4              # Optional: Parallel threads for execution
  mcp_server:             # Optional: MCP server config
    url: "https://your-server.com"
    name: "server-name"
    authorization_token: "your-token"
```

> Note: For a one-time run of a saved suite, you can override any metadata at the command line (model, system prompt, threads, and MCP settings).

```bash
# Run a saved suite with one-time overrides
vibe check my-eval-suite \
  --model openai/gpt-4o \
  --system-prompt "You are a terse, helpful assistant." \
  --threads 8 \
  --mcp-url https://your-mcp-server.com \
  --mcp-name server-name \
  --mcp-token your-token
```

## Vibe Ratings

vibes breakdown as follows.

- ✨ **good vibes** = >80% pass rate
- 😬 **sketchy vibes** = 50-80% pass rate  
- 🚩 **bad vibes** = <50% pass rate

**Individual Check Results:**
- ✅ **PASS** - Check passed
- 🚩 **FAIL** - Check failed

**Exit Codes:**
- `0` - Good or sketchy vibes (≥50% pass rate)
- `1` - Bad vibes (<50% pass rate)

---

**Wanna check the vibe?** Get started at [vibescheck.io](https://vibescheck.io) 🚀