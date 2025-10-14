import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { InteractiveUI } from '../ui/interactive';

interface OnboardingData {
  name: string;
  model: string;
  systemPrompt: string;
  prompt: string;
  searchString: string;
  semanticTarget: string;
  judgeCriteria: string;
}

export async function runOnboarding(ui: InteractiveUI): Promise<string> {
  return new Promise((resolve) => {
    const data: Partial<OnboardingData> = {};
    let currentStep = 0;

    const steps = [
      {
        question: "What would you like to name this eval suite?",
        key: 'name' as keyof OnboardingData,
        placeholder: 'my-first-eval',
        suggestion: 'my-first-eval'
      },
      {
        question: "Which model would you like to use?",
        key: 'model' as keyof OnboardingData,
        placeholder: 'anthropic/claude-3-5-sonnet',
        suggestion: 'anthropic/claude-3-5-sonnet'
      },
      {
        question: "What personality should the AI have?",
        key: 'systemPrompt' as keyof OnboardingData,
        placeholder: 'Be witty and fun! Use lots of emojis! 🎉',
        suggestion: 'You are a helpful assistant who loves emojis and making witty jokes! 🎭✨'
      },
      {
        question: "What should we ask the AI?",
        key: 'prompt' as keyof OnboardingData,
        placeholder: 'Tell me a fun fact about space!',
        suggestion: 'Tell me a fun fact about space!'
      },
      {
        question: "What should be in the response? (string_contains check)",
        key: 'searchString' as keyof OnboardingData,
        placeholder: '🌟 or ✨',
        suggestion: '✨'
      },
      {
        question: "What should the response be semantically similar to? (semantic_similarity check)",
        key: 'semanticTarget' as keyof OnboardingData,
        placeholder: 'An interesting fact about astronomy',
        suggestion: 'A fun and interesting response about the topic'
      },
      {
        question: "What criteria should the LLM judge use? (llm_judge check)",
        key: 'judgeCriteria' as keyof OnboardingData,
        placeholder: 'Response is engaging and fun',
        suggestion: 'Response should be engaging and on-topic'
      }
    ];

    const updateYAMLPreview = () => {
      const yamlContent = generatePartialYAML(data);
      ui.clearResults();
      ui.setFilePathLabel('evals.yaml (preview)');
      ui.appendResults(yamlContent);
    };

    const promptNextStep = () => {
      if (currentStep < steps.length) {
        const step = steps[currentStep];

        // Update YAML preview in top pane
        updateYAMLPreview();

        // Show question in results/summary pane (bottom yellow box)
        const lines: string[] = [];
        lines.push('');
        lines.push('{bold}{cyan-fg}Let\'s create your first eval suite!{/cyan-fg}{/bold}');
        lines.push('');
        lines.push(`{yellow-fg}Step ${currentStep + 1} of ${steps.length}{/yellow-fg}`);
        lines.push('');
        lines.push(`{bold}${step.question}{/bold}`);
        lines.push(`{gray-fg}Press Enter for:{/gray-fg} {white-fg}${step.suggestion}{/white-fg}`);
        lines.push('');

        ui.displayInfo(lines.join('\n'));
      } else {
        // All steps complete
        completeOnboarding();
      }
    };

    const completeOnboarding = () => {
      const yamlContent = generateYAML(data as OnboardingData);
      const formattedYAML = generateFormattedYAML(data as OnboardingData);

      // Update final YAML preview in top pane
      ui.clearResults();
      ui.setFilePathLabel('evals.yaml');
      ui.appendResults(formattedYAML);

      // Show completion message in bottom pane
      const lines: string[] = [];
      lines.push('');
      lines.push('{bold}{green-fg}✨ Eval suite created successfully!{/green-fg}{/bold}');
      lines.push('');

      // Write to file
      try {
        fs.writeFileSync('./evals.yaml', yamlContent);
        lines.push('{green-fg}✅ Saved to ./evals.yaml{/green-fg}');
        lines.push('');
        lines.push('{yellow-fg}Run :check to test your eval suite!{/yellow-fg}');
        lines.push('');

        ui.displayInfo(lines.join('\n'));
        resolve('./evals.yaml');
      } catch (error: any) {
        ui.displayError(`Failed to write evals.yaml: ${error.message}`);
        resolve('');
      }
    };

    const handleInput = (input: string) => {
      const trimmed = input.trim();
      const step = steps[currentStep];

      // If empty, use the suggestion
      if (!trimmed) {
        (data as any)[step.key] = step.suggestion;
      } else {
        (data as any)[step.key] = trimmed;
      }

      currentStep++;
      promptNextStep();
    };

    // Set up one-time command handler for onboarding
    ui.setOnboardingHandler(handleInput);

    // Start onboarding
    promptNextStep();
  });
}

function generatePartialYAML(data: Partial<OnboardingData>): string {
  const lines: string[] = [];

  lines.push('{gray-fg}metadata:{/gray-fg}');

  // name
  if (data.name) {
    lines.push(`{gray-fg}  name:{/gray-fg} {cyan-fg}${data.name}{/cyan-fg}`);
  } else {
    lines.push('{gray-fg}  name: <name>{/gray-fg}');
  }

  // model
  if (data.model) {
    lines.push(`{gray-fg}  model:{/gray-fg} {cyan-fg}${data.model}{/cyan-fg}`);
  } else {
    lines.push('{gray-fg}  model: <model>{/gray-fg}');
  }

  // system_prompt
  if (data.systemPrompt) {
    lines.push(`{gray-fg}  system_prompt:{/gray-fg} {cyan-fg}${data.systemPrompt}{/cyan-fg}`);
  } else {
    lines.push('{gray-fg}  system_prompt: <system_prompt>{/gray-fg}');
  }

  lines.push('{gray-fg}evals:{/gray-fg}');
  lines.push('{gray-fg}  - name: first_eval{/gray-fg}');

  // prompt
  if (data.prompt) {
    lines.push(`{gray-fg}    prompt:{/gray-fg} {cyan-fg}${data.prompt}{/cyan-fg}`);
  } else {
    lines.push('{gray-fg}    prompt: <prompt>{/gray-fg}');
  }

  lines.push('{gray-fg}    checks:{/gray-fg}');

  // string_contains check
  lines.push('{gray-fg}      - type: string_contains{/gray-fg}');
  if (data.searchString) {
    lines.push(`{gray-fg}        value:{/gray-fg} {cyan-fg}${data.searchString}{/cyan-fg}`);
  } else {
    lines.push('{gray-fg}        value: <expected_string>{/gray-fg}');
  }

  // semantic_similarity conditional
  lines.push('{gray-fg}      - type: semantic_similarity{/gray-fg}');
  if (data.semanticTarget) {
    lines.push(`{gray-fg}        expected:{/gray-fg} {cyan-fg}${data.semanticTarget}{/cyan-fg}`);
  } else {
    lines.push('{gray-fg}        expected: <semantic_target>{/gray-fg}');
  }
  lines.push('{gray-fg}        threshold: 0.6{/gray-fg}');

  // llm_judge conditional
  lines.push('{gray-fg}      - type: llm_judge{/gray-fg}');
  if (data.judgeCriteria) {
    lines.push(`{gray-fg}        criteria:{/gray-fg} {cyan-fg}${data.judgeCriteria}{/cyan-fg}`);
  } else {
    lines.push('{gray-fg}        criteria: <judge_criteria>{/gray-fg}');
  }

  return lines.join('\n');
}

function generateYAML(data: OnboardingData): string {
  const evalSuite = {
    metadata: {
      name: data.name,
      model: data.model,
      system_prompt: data.systemPrompt
    },
    evals: [
      {
        name: 'first_eval',
        prompt: data.prompt,
        checks: [
          {
            type: 'string_contains',
            value: data.searchString
          },
          {
            type: 'semantic_similarity',
            expected: data.semanticTarget,
            threshold: 0.6
          },
          {
            type: 'llm_judge',
            criteria: data.judgeCriteria,

          }
        ]
      }
    ]
  };

  return yaml.dump(evalSuite, {
    indent: 2,
    lineWidth: -1
  });
}

function generateFormattedYAML(data: OnboardingData): string {
  const lines: string[] = [];

  lines.push('{gray-fg}metadata:{/gray-fg}');
  lines.push(`{gray-fg}  name:{/gray-fg} {cyan-fg}${data.name}{/cyan-fg}`);
  lines.push(`{gray-fg}  model:{/gray-fg} {cyan-fg}${data.model}{/cyan-fg}`);
  lines.push(`{gray-fg}  system_prompt:{/gray-fg} {cyan-fg}${data.systemPrompt}{/cyan-fg}`);
  lines.push('{gray-fg}evals:{/gray-fg}');
  lines.push('{gray-fg}  - name: first_eval{/gray-fg}');
  lines.push(`{gray-fg}    prompt:{/gray-fg} {cyan-fg}${data.prompt}{/cyan-fg}`);
  lines.push('{gray-fg}    checks:{/gray-fg}');
  lines.push('{gray-fg}      - type: string_contains{/gray-fg}');
  lines.push(`{gray-fg}        value:{/gray-fg} {cyan-fg}${data.searchString}{/cyan-fg}`);
  lines.push('{gray-fg}      - type: semantic_similarity{/gray-fg}');
  lines.push(`{gray-fg}        expected:{/gray-fg} {cyan-fg}${data.semanticTarget}{/cyan-fg}`);
  lines.push('{gray-fg}        threshold: 0.6{/gray-fg}');
  lines.push('{gray-fg}      - type: llm_judge{/gray-fg}');
  lines.push(`{gray-fg}        criteria:{/gray-fg} {cyan-fg}${data.judgeCriteria}{/cyan-fg}`);

  return lines.join('\n');
}
