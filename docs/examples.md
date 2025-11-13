# Featured Examples

Comprehensive examples demonstrating vibecheck's capabilities.

## Table of Contents

- [Multilingual Testing](#-multilingual-testing)
- [MCP Tool Integration](#-mcp-tool-integration)
- [Advanced Evaluation Patterns](#-advanced-evaluation-patterns)

## 🌍 Multilingual Testing

Test your model across 10+ languages with the same evaluation.

### Example: Multilingual PB&J Instructions

This example tests a model's ability to describe making a peanut butter and jelly sandwich in multiple languages:

```yaml
# examples/multilingual-pbj.yaml
metadata:
  name: multilingual-pbj
  model: meta-llama/llama-4-maverick
  system_prompt: "You are a translator. Respond both in the language the question is asked as well as English."

evals:
  - prompt: "Describe how to make a peanut butter and jelly sandwich."
    checks:
      - match: "*bread*"
      - llm_judge:
          criteria: "Does this accurately describe how to make a peanut butter and jelly sandwich in English"
      - min_tokens: 20
      - max_tokens: 300

  - prompt: "Décrivez comment faire un sandwich au beurre d'arachide et à la confiture."
    checks:
      - match: "*pain*"
      - llm_judge:
          criteria: "Does this accurately describe how to make a peanut butter and jelly sandwich in French"
      - min_tokens: 20
      - max_tokens: 300
```

### Running the Example

```bash
vibe check -f examples/multilingual-pbj.yaml
```

### Key Features

- **Pattern Matching**: Validates language-specific keywords (e.g., "bread" in English, "pain" in French)
- **LLM Judge**: Ensures the response is accurate in the target language
- **Token Constraints**: Enforces appropriate response length

## 🔧 MCP Tool Integration

Validate MCP (Model Context Protocol) tool calling with external services. This example shows how to test Linear MCP integration using secrets and variables to securely configure the MCP server.

### Step 1: Get Your Linear API Key

Obtain your Linear API key from your Linear workspace settings. Navigate to Settings → API → Personal API Keys in your Linear workspace to create a new API key.

### Step 2: Set Up the Secret

Set your Linear API key as a secret (sensitive, write-only):

```bash
vibe set secret linear.apiKey "your-linear-api-key-here"
```

### Step 3: Set Up Variables

Set your Linear project ID and team name as variables:

```bash
vibe set var linear.projectId "your-project-id"
vibe set var linear.projectTeam "your-team-name"
```

### Step 4: Run the Evaluation

Run the [Linear MCP evaluation](../examples/linear-mcp.yaml) (the suite is preloaded):

```bash
vibe check linear-mcp
```

### What It Tests

The evaluation tests three scenarios:
1. **Listing Issues**: Retrieves recent issues from your Linear workspace
2. **Issue Details**: Gets details on a specific Linear todo item
3. **Creating Items**: Creates a new todo item in Linear

### Key Features

- **Secret Management**: API keys are stored securely and never exposed
- **Variable Substitution**: Configuration values can be updated without modifying YAML
- **MCP Integration**: Tests tool calling and external service integration
- **Runtime Resolution**: Secrets and vars are resolved when the evaluation runs

Secrets and vars are resolved at runtime when the evaluation runs, so you can update them without modifying your YAML files.

## 🧠 Advanced Evaluation Patterns

Combine multiple check types for comprehensive testing.

### Example: Mixed Check Types

This example demonstrates combining semantic similarity, LLM judges, pattern matching, and token constraints:

```yaml
# examples/hello-world.yaml
evals:
  - prompt: How are you today?
    checks:
      - semantic:
          expected: "I'm doing well, thank you for asking"
          threshold: 0.7
      - llm_judge:
          criteria: "Is this a friendly and appropriate response to 'How are you today?'"
      - min_tokens: 10
      - max_tokens: 100

  - prompt: What is 2+2?
    checks:
      - or:
          - match: "*4*"
          - match: "*four*"
      - llm_judge:
          criteria: "Is this a correct mathematical answer to 2+2?"
      - min_tokens: 1
      - max_tokens: 20
```

### Running the Example

```bash
vibe check -f examples/hello-world.yaml
```

### Check Type Combinations

This example showcases:

1. **Semantic Similarity**: Validates meaning rather than exact wording
2. **LLM Judge**: Subjective quality assessment
3. **Token Constraints**: Ensures concise responses
4. **OR Logic**: Accepts multiple valid answer formats
5. **Pattern Matching**: Simple text validation

### When to Use Each Check Type

- **`match`**: When you need specific keywords or phrases
- **`semantic`**: When meaning matters more than exact wording
- **`llm_judge`**: For subjective quality or complex criteria
- **`min_tokens`/`max_tokens`**: To enforce response length
- **`or`**: When multiple valid formats exist
- **`not_match`**: To exclude unwanted content

## More Examples

Additional examples are available in the [`examples/`](../examples/) directory:

- **`hello-world.yaml`**: Basic checks and getting started
- **`finance.yaml`**: Financial knowledge evaluation
- **`healthcare.yaml`**: Medical knowledge evaluation
- **`lang.yaml`**: Multilingual capabilities
- **`politics.yaml`**: Political knowledge evaluation
- **`sports.yaml`**: Sports knowledge evaluation
- **`strawberry.yaml`**: Reasoning capabilities

### Running All Examples

```bash
# Set your API key
export VIBECHECK_API_KEY=your-api-key

# Build and run all examples
npm run build
npm run test:examples
```

See [Example Tests README](../tests/examples/README.md) for more details on automated example testing.

---

[← Back to README](../README.md) | [YAML Syntax Reference](./yaml-syntax.md) | [CLI Reference](./cli-reference.md)
