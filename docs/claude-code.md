# Using vibecheck with Claude Code

vibecheck provides deep integration with Claude Code through **custom skills** and a **specialized agent** that make working with evaluations faster and more intuitive.

## Overview

When you use Claude Code in a vibecheck project, you get:

1. **Skills** - Custom knowledge files that teach Claude the vibecheck CLI and YAML syntax
2. **Agent** - A specialized "vibe-checker" agent for creating and running comprehensive eval suites
3. **Automatic Invocation** - Claude autonomously uses the right tool for your task

## Skills

Skills are markdown files in `.claude/skills/` that provide Claude with domain-specific knowledge. They're automatically loaded and Claude decides when to use them based on context.

### Available Skills

#### 1. vibecheck-cli

**Location:** `.claude/skills/vibecheck-cli.md`

Teaches Claude how to use the vibecheck command-line interface.

**Covers:**
- Running evaluations (`vibe check`)
- Managing suites (save, retrieve, list)
- Viewing and filtering runs
- Managing runtime variables and secrets
- Available models and org info
- Common workflows

**Example:**
```
You: "Show me recent runs with >80% success rate"
Claude: vibe get runs --success-gt 80
```

#### 2. vibecheck-eval-writer

**Location:** `.claude/skills/vibecheck-eval-writer.md`

Teaches Claude how to write vibecheck evaluation YAML files.

**Covers:**
- Complete YAML syntax
- All check types (match, semantic, llm_judge, tokens)
- AND/OR logic patterns
- Template variables and secrets
- Best practices
- Common patterns

**Example:**
```
You: "Create a check that accepts 'yes' or 'affirmative'"
Claude: [Creates YAML with OR logic]
```

```yaml
checks:
  or:
    - match: "*yes*"
    - match: "*affirmative*"
```

#### 3. yaml-syntax

**Location:** `.claude/skills/yaml-syntax.md`

Quick reference for vibecheck YAML syntax and common patterns.

## Agent: vibe-checker

The **vibe-checker** agent is a specialized integration testing expert that creates, runs, and improves vibecheck evaluation suites.

### When to Use

Use the vibe-checker agent when you need:
- **Comprehensive test suites** with multiple test cases
- **Creative check patterns** using various check types
- **Multi-model comparisons** running the same eval across different models
- **Eval debugging** when checks aren't working as expected
- **Test strategy** advice on how to best evaluate specific features

### How to Invoke

**Explicit invocation:**
```
@agent-vibe-checker create an eval that tests multilingual support
```

**Automatic invocation:**

Claude will automatically suggest using the vibe-checker agent when you mention:
- Testing or quality assurance needs
- Creating evaluation suites
- Debugging failing evals
- Comparing model behaviors

### Agent Capabilities

The vibe-checker agent excels at:

1. **YAML Eval Design** - Creates well-structured evaluation suites
2. **Creative Check Patterns** - Uses glob, regex, semantic, and LLM judges effectively
3. **Synthetic Data Generation** - Generates diverse test cases
4. **CLI Operations** - Runs evals, manages suites, analyzes results
5. **Debugging** - Identifies why evals fail and suggests fixes
6. **Test Strategy** - Recommends the right check types for your use case

### Agent Philosophy

The vibe-checker agent understands:
- Good evals don't always pass 100% (LLMs have natural variability)
- Clever patterns beat brute force
- Edge cases matter
- Synthetic data is powerful
- LLM judges are useful but need specific criteria

## Skills + Agent: Better Together

Skills and the agent work together seamlessly:

### Example Workflow 1: Quick Command

**You:** "List my saved suites"

**Claude:** (Uses **vibecheck-cli skill**)
```bash
vibe get suites
```

### Example Workflow 2: Create Simple Eval

**You:** "Create an eval that checks if responses are under 50 tokens"

**Claude:** (Uses **vibecheck-eval-writer skill**)
```yaml
metadata:
  name: token-limit-test
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: "Explain quantum computing briefly"
    checks:
      - max_tokens: 50
```

### Example Workflow 3: Comprehensive Testing

**You:** "I need to test my chatbot's tone across different user personas"

**Claude:** (Invokes **vibe-checker agent**)

The agent will:
1. Design a comprehensive eval suite with multiple personas
2. Create checks for tone consistency
3. Add semantic similarity checks
4. Include LLM judge for subjective quality
5. Run the eval and analyze results
6. Provide recommendations

### Example Workflow 4: Multi-Model Comparison

**You:** "@agent-vibe-checker compare how different models handle sarcasm detection"

**vibe-checker agent:**
1. Creates an eval with sarcastic and non-sarcastic prompts
2. Runs it across multiple models (Claude, GPT, Gemini, etc.)
3. Returns a comparison table showing which models performed best
4. Analyzes cost vs. accuracy trade-offs

## Practical Examples

### Example 1: Testing a New Feature

**Scenario:** You just built a feature that generates product descriptions.

**You:** "I just added a feature that generates product descriptions. Can you help me test it?"

**Claude:** *I'm going to use the vibe-checker agent to create and run an evaluation suite for your product description feature.*

**Agent creates:**
```yaml
metadata:
  name: product-description-quality
  model: anthropic/claude-3.5-sonnet
  system_prompt: "Generate compelling product descriptions"

evals:
  - prompt: "Generate a description for: Wireless Bluetooth Headphones"
    checks:
      - match: "*wireless*"
      - match: "*bluetooth*"
      - min_tokens: 30
      - max_tokens: 150
      - llm_judge:
          criteria: "Description is compelling, accurate, and professional"
      - not_match: "*error*"

  - prompt: "Generate a description for: Organic Coffee Beans"
    checks:
      - match: "*organic*"
      - match: "*coffee*"
      - min_tokens: 30
      - max_tokens: 150
      - llm_judge:
          criteria: "Description highlights quality and taste"

  - prompt: "Generate a description for: Stainless Steel Water Bottle"
    checks:
      - or:
          - match: "*stainless*"
          - match: "*steel*"
      - min_tokens: 30
      - max_tokens: 150
```

### Example 2: Debugging a Failing Eval

**Scenario:** Your eval keeps failing even though outputs look correct.

**You:** "My translation eval keeps failing. The check is `match: '*bonjour*'` but the model says 'Bonjour!'"

**Claude:** (Uses **vibecheck-eval-writer skill**)

*The issue is case sensitivity. Glob patterns in vibecheck are case-insensitive by default, so that's not the problem. Let me check if there are hidden characters or if the check needs to be more flexible:*

```yaml
# Try this instead:
checks:
  - or:
      - match: "*bonjour*"
      - match: "*salut*"
      - match: "*hello*"  # Accept English too
  - min_tokens: 5  # Ensure it's not just "Bonjour!"
```

### Example 3: Using Template Variables

**You:** "How do I make my eval work with different models?"

**Claude:** (Uses **vibecheck-cli** and **vibecheck-eval-writer** skills)

*Set up a variable for the model name:*

```bash
vibe set var model_name "anthropic/claude-3.5-sonnet"
```

*Then use it in your YAML:*

```yaml
metadata:
  model: "{{var('model_name')}}"
```

*To run with a different model:*

```bash
vibe set var model_name "openai/gpt-4"
vibe check -f my-eval.yaml
```

### Example 4: Complex Multi-Model Analysis

**You:** "@agent-vibe-checker test which models best understand training cutoff dates"

**Agent response:**
- Creates eval asking models about their training data cutoff
- Runs across 7+ models (Claude, GPT, Gemini, Llama, etc.)
- Returns comprehensive comparison table
- Shows which models have most recent training data
- Analyzes response patterns and cost efficiency

## How Skills Work

### Automatic Activation

Skills are loaded automatically when you work in the vibecheck repository. No manual activation needed.

### Skill Invocation

Claude decides when to use skills based on:
- Skill descriptions in frontmatter
- Context of your request
- Relevance to the task

### Skill Composition

Skills work together:
1. **vibecheck-eval-writer** helps create YAML
2. **vibecheck-cli** helps run it
3. Both reference **yaml-syntax** for details

## How the Agent Works

### Agent Personality

The vibe-checker agent has a fun, enthusiastic personality:
- Casual, friendly language
- Creative eval names ("sarcasm-detector" not "test1")
- Celebrates catching bugs ("Aha! 🎯")
- Shares testing wisdom
- Uses emojis occasionally ✨

### Agent Workflow

When you invoke the agent, it:

1. **Understands the Goal** - What behavior are we testing?
2. **Designs Check Strategy** - Chooses the right check types
3. **Creates Diverse Test Cases** - Covers normal, edge, and adversarial cases
4. **Sets Realistic Expectations** - Doesn't expect 100% pass rates unnecessarily
5. **Iterates** - Runs, analyzes, refines

### Agent Quality Standards

The agent always:
- Uses descriptive eval names
- Includes comments for complex checks
- Tests evals before finishing
- Explains check choices
- Suggests improvements
- Considers performance and cost

## Best Practices

### For Quick Tasks

Use Claude normally - skills will activate automatically:

✅ "Run my eval file"
✅ "List recent runs"
✅ "Set a variable for the model name"

### For Comprehensive Testing

Invoke the agent explicitly:

✅ "@agent-vibe-checker create a comprehensive eval suite for my API"
✅ "@agent-vibe-checker compare these 5 models on accuracy"
✅ "@agent-vibe-checker debug why this eval is failing"

### Combining Both

Let them work together naturally:

```
You: "Create an eval for testing code explanations"
Claude: [Uses vibecheck-eval-writer skill to create YAML]

You: "Now run it across multiple models"
Claude: [Invokes vibe-checker agent to run comprehensive comparison]
```

## Customization

### Modifying Skills

Skills are in `.claude/skills/` and can be edited:

```bash
# Edit a skill
nano .claude/skills/vibecheck-cli.md

# Changes take effect immediately
```

### Modifying the Agent

The agent is in `.claude/agents/vibe-checker.md` and can be customized:

```bash
# Edit agent
nano .claude/agents/vibe-checker.md

# Restart Claude Code to load changes
```

## Common Workflows

### Workflow 1: Feature Development

1. Develop feature
2. Ask Claude: "Create tests for this feature"
3. Agent creates comprehensive eval suite
4. Run evals
5. Fix issues
6. Re-run until passing

### Workflow 2: Model Selection

1. Create eval for your use case
2. Ask agent: "Compare models on this eval"
3. Review results table
4. Choose best model based on accuracy + cost

### Workflow 3: Continuous Testing

1. Save eval suite: `vibe set suite -f my-eval.yaml`
2. Run regularly: `vibe check my-suite-name`
3. Track changes: `vibe get runs --suite my-suite-name`
4. Refine based on patterns

### Workflow 4: Debugging Production Issues

1. Describe issue to Claude
2. Agent creates targeted eval reproducing issue
3. Run across models to identify problem
4. Use results to fix root cause

## Tips & Tricks

### Get Better Results

1. **Be Specific**: "Test multilingual greetings in French and Spanish" vs "test greetings"
2. **Provide Context**: Share what you're building and what you want to validate
3. **Ask for Explanations**: "Why use semantic instead of pattern matching?"
4. **Iterate**: "Make this check more flexible" or "Add edge cases"

### Agent Pro Tips

- Agent is great for **initial eval creation** and **comprehensive testing**
- Agent excels at **synthetic data generation** and **multi-model comparisons**
- Agent can **debug complex failures** and **suggest optimizations**
- Invoke explicitly with `@agent-vibe-checker` for best results

### Skills Pro Tips

- Skills provide **instant answers** for syntax questions
- Skills are perfect for **quick CLI commands**
- Skills help with **YAML structure** and **check patterns**
- Skills work automatically - no need to invoke

## Troubleshooting

### Skill Not Being Used

**Symptoms:** Claude doesn't seem to know vibecheck syntax

**Solutions:**
1. Be explicit: "Create a vibecheck eval..." instead of "Create a test..."
2. Check `.claude/skills/` exists and has .md files
3. Verify skill descriptions match your request

### Agent Not Invoking

**Symptoms:** Claude doesn't suggest using the agent

**Solutions:**
1. Invoke explicitly: `@agent-vibe-checker ...`
2. Mention "comprehensive testing" or "eval suite"
3. Check `.claude/agents/vibe-checker.md` exists

### Eval Syntax Errors

**Symptoms:** YAML validation fails

**Solutions:**
1. Ask Claude: "Fix this YAML syntax error"
2. Skills will help correct the format
3. Check examples in `examples/` directory

## Learn More

### Documentation

- [CLI Reference](./cli-reference.md)
- [YAML Syntax](./yaml-syntax.md)
- [Examples](./examples.md)
- [Programmatic API](./programmatic-api.md)

### External Resources

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Claude Code Agents Documentation](https://code.claude.com/docs/en/agents)
- [vibecheck API](https://vibescheck.io)

### Skill & Agent Files

Located in your project:
- `.claude/skills/vibecheck-cli.md`
- `.claude/skills/vibecheck-eval-writer.md`
- `.claude/skills/yaml-syntax.md`
- `.claude/agents/vibe-checker.md`

---

**Ready to vibe check?** Let Claude Code help you build comprehensive evaluation suites with minimal effort! 🚀
