# Claude Code Skills for vibecheck

vibecheck includes custom Claude Code skills that teach Claude how to use the CLI and write evaluation files effectively.

## What are Claude Code Skills?

[Claude Code skills](https://www.claude.com/blog/skills) are custom knowledge files that help Claude understand domain-specific tools and workflows. When you use Claude Code in a vibecheck project, these skills are automatically available and Claude will use them when relevant.

## Available Skills

### 1. vibecheck-cli

**Location:** `.claude/skills/vibecheck-cli.md`

**Purpose:** Teaches Claude how to run and manage vibecheck commands.

**Use Cases:**
- Running evaluations
- Managing suites (save, retrieve, list)
- Viewing and filtering past runs
- Managing runtime variables and secrets
- Viewing available models and org info

**Example Interactions:**

```
User: "Run the eval in examples/hello-world.yaml"
Claude: [Uses vibecheck-cli skill to run the correct command]
```

```
User: "Show me my recent runs with >80% success rate"
Claude: vibe get runs --success-gt 80
```

```
User: "Set up a variable for the model name"
Claude: vibe set var model_name "anthropic/claude-3.5-sonnet"
```

### 2. vibecheck-eval-writer

**Location:** `.claude/skills/vibecheck-eval-writer.md`

**Purpose:** Teaches Claude how to write vibecheck evaluation YAML files.

**Use Cases:**
- Creating new evaluation suites
- Adding or modifying checks
- Using template variables and secrets
- Implementing complex check logic (AND/OR)
- Following best practices for eval design

**Example Interactions:**

```
User: "Create an eval that tests if the model explains quantum computing in 50-100 tokens"
Claude: [Uses vibecheck-eval-writer skill to create proper YAML]
```

```yaml
metadata:
  name: quantum-explanation
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: "Explain quantum computing in simple terms"
    checks:
      - match: "*quantum*"
      - min_tokens: 50
      - max_tokens: 100
      - llm_judge:
          criteria: "Explanation is clear and accurate"
```

```
User: "How do I make a check that accepts either 'yes' or 'affirmative'?"
Claude: [Uses skill to show OR logic pattern]
```

```yaml
checks:
  or:
    - match: "*yes*"
    - match: "*affirmative*"
```

### 3. yaml-syntax (Reference)

**Location:** `.claude/skills/yaml-syntax.md`

**Purpose:** Quick reference for vibecheck YAML syntax.

**Contains:**
- File structure overview
- All check types with examples
- Logic operators (AND/OR)
- Template variable syntax
- Common patterns

## How Skills Work

### Automatic Activation

Skills are automatically loaded when you use Claude Code in this repository. You don't need to do anything to activate them.

### Skill Invocation

Claude autonomously decides when to use each skill based on:
- The skill's description
- The context of your request
- Relevance to the task at hand

### Skill Composition

Skills can work together. For example:
1. **vibecheck-eval-writer** helps you create a YAML file
2. **vibecheck-cli** helps you run it with `vibe check`
3. Both reference **yaml-syntax** for specific syntax details

## Using Skills Effectively

### For Running Evals

When you want to run evaluations or manage the CLI, simply ask naturally:

- ✅ "Run my eval file"
- ✅ "Show me recent runs for the hello-world suite"
- ✅ "Set a secret for my API key"
- ✅ "List all available models"

Claude will automatically use the **vibecheck-cli** skill to provide accurate commands.

### For Writing Evals

When you want to create or modify evaluation files, ask naturally:

- ✅ "Create an eval that checks for polite responses"
- ✅ "Add a semantic similarity check"
- ✅ "How do I use template variables?"
- ✅ "Make this check accept multiple valid answers"

Claude will automatically use the **vibecheck-eval-writer** skill to generate proper YAML.

### Best Practices

1. **Be Specific**: The more context you provide, the better Claude can help
   - Good: "Create an eval that tests multilingual support with French and Spanish"
   - Better: "Create an eval that asks 'hello' in French and Spanish, checking for appropriate greetings with 10-50 tokens"

2. **Ask for Explanations**: Skills help Claude explain why something is done a certain way
   - "Why should I use semantic checks instead of pattern matching?"
   - "What's the difference between variables and secrets?"

3. **Iterate**: Skills help with refinement
   - "Add a length constraint to this eval"
   - "Make this check more flexible"
   - "Convert this to use template variables"

## Skill Content Overview

### vibecheck-cli Teaches

- Command syntax and options
- Common workflows (run → save → review)
- Variable and secret management
- Filtering and pagination
- Output interpretation
- Setup and configuration

### vibecheck-eval-writer Teaches

- Complete YAML structure
- All check types (match, semantic, llm_judge, tokens)
- AND/OR logic patterns
- Template variable usage
- Best practices for eval design
- Common patterns and anti-patterns
- Model format and MCP configuration

### yaml-syntax Provides

- Quick syntax reference
- Check type examples
- Template variable syntax
- CLI commands for variable management

## Examples

### Example 1: Creating and Running an Eval

**User:** "Create an eval that tests if the model can explain recursion simply"

**Claude:** (Uses vibecheck-eval-writer skill)

```yaml
metadata:
  name: explain-recursion
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: "Explain recursion in simple terms"
    checks:
      - match: "*function*"
      - match: "*itself*"
      - min_tokens: 30
      - max_tokens: 150
      - llm_judge:
          criteria: "Explanation is clear and uses simple language"
```

**User:** "Run it"

**Claude:** (Uses vibecheck-cli skill)

```bash
vibe check -f explain-recursion.yaml
```

### Example 2: Using Variables

**User:** "How do I make my eval use different models?"

**Claude:** (Uses both skills)

First, set up a variable:
```bash
vibe set var model_name "anthropic/claude-3.5-sonnet"
```

Then use it in your YAML:
```yaml
metadata:
  model: "{{var('model_name')}}"
```

To run with a different model:
```bash
vibe set var model_name "openai/gpt-4"
vibe check -f my-eval.yaml
```

### Example 3: Complex Check Logic

**User:** "Create a check that requires a greeting AND accepts either 'hello' or 'hi'"

**Claude:** (Uses vibecheck-eval-writer skill)

```yaml
checks:
  - min_tokens: 5        # Must be at least 5 tokens
  - or:                  # One of these must match
      - match: "*hello*"
      - match: "*hi*"
  - llm_judge:          # Must be polite
      criteria: "Response is friendly and welcoming"
```

## Customizing Skills

Skills are stored in `.claude/skills/` and can be modified to fit your workflow:

```bash
# Edit a skill
nano .claude/skills/vibecheck-cli.md

# Add examples specific to your use case
# Update command patterns you use frequently
# Add workflow shortcuts
```

Changes take effect immediately - no restart needed.

## Troubleshooting

### Skill Not Being Used

If Claude doesn't seem to use a skill:

1. **Check the description**: Skills are invoked based on their description in the frontmatter
2. **Be explicit**: Mention the specific task (e.g., "write an eval" vs "help me")
3. **Verify location**: Skills must be in `.claude/skills/` with `.md` extension

### Incorrect Information

If a skill provides outdated info:

1. **Update the skill file**: Edit `.claude/skills/vibecheck-*.md`
2. **Check the main docs**: Ensure consistency with `docs/` folder
3. **Report issues**: Skills should match the actual CLI behavior

### Finding Skills

To see what skills are available:

```bash
ls -la .claude/skills/
```

To read a skill:

```bash
cat .claude/skills/vibecheck-cli.md
```

## Contributing

When adding features to vibecheck, update the relevant skills:

1. **New CLI command**: Update `vibecheck-cli.md`
2. **New check type**: Update `vibecheck-eval-writer.md` and `yaml-syntax.md`
3. **Changed syntax**: Update all relevant skills

This ensures Claude always has accurate, up-to-date knowledge.

## Learn More

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Skills Cookbook](https://github.com/anthropics/claude-cookbooks/tree/main/skills)
- [vibecheck CLI Reference](./cli-reference.md)
- [vibecheck YAML Syntax](./yaml-syntax.md)

---

**Pro Tip**: Skills make Claude Code your vibecheck expert. Ask questions naturally and let the skills guide the interaction!
