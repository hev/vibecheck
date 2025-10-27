import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { InteractiveUI } from '../ui/interactive';

interface OnboardingData {
  name: string;
  model: string;
  systemPrompt: string;
  // Eval 1: Say Hello
  prompt1: string;
  match1: string;
  minTokens1: number;
  maxTokens1: number;
  // Eval 2: How are you today?
  prompt2: string;
  semanticExpected: string;
  semanticThreshold: number;
  judgeCriteria2: string;
  minTokens2: number;
  maxTokens2: number;
  // Eval 3: What is 2+2?
  prompt3: string;
  match3: string;
  judgeCriteria3: string;
  minTokens3: number;
  maxTokens3: number;
}

function loadHelloWorldDefaults(): Partial<OnboardingData> {
  const defaults: Partial<OnboardingData> = {};
  
  try {
    const helloWorldPath = path.join(process.cwd(), 'examples', 'hello-world.yaml');
    if (fs.existsSync(helloWorldPath)) {
      const helloWorldContent = fs.readFileSync(helloWorldPath, 'utf8');
      const helloWorldData = yaml.load(helloWorldContent) as any;
      
      // Extract defaults from hello-world.yaml
      defaults.name = helloWorldData.metadata?.name || 'hello-world';
      defaults.model = helloWorldData.metadata?.model || 'google/gemini-2.5-flash-lite-preview-09-2025';
      defaults.systemPrompt = helloWorldData.metadata?.system_prompt || 'You are a helpful assistant. Keep your responses short and concise.';
      
      // Extract from first eval (Say Hello)
      if (helloWorldData.evals?.[0]) {
        defaults.prompt1 = helloWorldData.evals[0].prompt || 'Say Hello';
        defaults.match1 = helloWorldData.evals[0].checks?.match || '*hello*';
        defaults.minTokens1 = helloWorldData.evals[0].checks?.min_tokens || 1;
        defaults.maxTokens1 = helloWorldData.evals[0].checks?.max_tokens || 50;
      }
      
      // Extract from second eval (How are you today?)
      if (helloWorldData.evals?.[1]) {
        defaults.prompt2 = helloWorldData.evals[1].prompt || 'How are you today?';
        defaults.semanticExpected = helloWorldData.evals[1].checks?.semantic?.expected || "I'm doing well, thank you for asking";
        defaults.semanticThreshold = helloWorldData.evals[1].checks?.semantic?.threshold || 0.7;
        defaults.judgeCriteria2 = helloWorldData.evals[1].checks?.llm_judge?.criteria || "Is this a friendly and appropriate response to 'How are you today?'?";
        defaults.minTokens2 = helloWorldData.evals[1].checks?.min_tokens || 10;
        defaults.maxTokens2 = helloWorldData.evals[1].checks?.max_tokens || 100;
      }
      
      // Extract from third eval (What is 2+2?)
      if (helloWorldData.evals?.[2]) {
        defaults.prompt3 = helloWorldData.evals[2].prompt || 'What is 2+2?';
        defaults.match3 = helloWorldData.evals[2].checks?.match || '*4*';
        defaults.judgeCriteria3 = helloWorldData.evals[2].checks?.llm_judge?.criteria || "Is this a correct mathematical answer to 2+2?";
        defaults.minTokens3 = helloWorldData.evals[2].checks?.min_tokens || 1;
        defaults.maxTokens3 = helloWorldData.evals[2].checks?.max_tokens || 20;
      }
    }
  } catch (error) {
    // Fall back to hardcoded defaults if file can't be read
    console.warn('Could not read hello-world.yaml, using hardcoded defaults');
  }
  
  return defaults;
}

export async function runOnboarding(ui: InteractiveUI): Promise<string> {
  return new Promise((resolve) => {
    const data: Partial<OnboardingData> = {};
    let currentStep = 0;
    
    // Load defaults from hello-world.yaml
    const helloWorldDefaults = loadHelloWorldDefaults();

    const steps = [
      {
        question: "What would you like to name this eval suite?",
        key: 'name' as keyof OnboardingData,
        placeholder: helloWorldDefaults.name || 'hello-world',
        suggestion: helloWorldDefaults.name || 'hello-world'
      },
      {
        question: "Which model would you like to use?",
        key: 'model' as keyof OnboardingData,
        placeholder: helloWorldDefaults.model || 'google/gemini-2.5-flash-lite-preview-09-2025',
        suggestion: helloWorldDefaults.model || 'google/gemini-2.5-flash-lite-preview-09-2025'
      },
      {
        question: "What personality should the AI have?",
        key: 'systemPrompt' as keyof OnboardingData,
        placeholder: helloWorldDefaults.systemPrompt || 'You are a helpful assistant. Keep your responses short and concise.',
        suggestion: helloWorldDefaults.systemPrompt || 'You are a helpful assistant. Keep your responses short and concise.'
      },
      {
        question: "First eval: What should we ask the AI?",
        key: 'prompt1' as keyof OnboardingData,
        placeholder: helloWorldDefaults.prompt1 || 'Say Hello',
        suggestion: helloWorldDefaults.prompt1 || 'Say Hello'
      },
      {
        question: "What should be in the response? (match pattern)",
        key: 'match1' as keyof OnboardingData,
        placeholder: helloWorldDefaults.match1 || '*hello*',
        suggestion: helloWorldDefaults.match1 || '*hello*'
      },
      {
        question: "Minimum tokens for first eval?",
        key: 'minTokens1' as keyof OnboardingData,
        placeholder: String(helloWorldDefaults.minTokens1 || 1),
        suggestion: helloWorldDefaults.minTokens1 || 1
      },
      {
        question: "Maximum tokens for first eval?",
        key: 'maxTokens1' as keyof OnboardingData,
        placeholder: String(helloWorldDefaults.maxTokens1 || 50),
        suggestion: helloWorldDefaults.maxTokens1 || 50
      },
      {
        question: "Second eval: What should we ask the AI?",
        key: 'prompt2' as keyof OnboardingData,
        placeholder: helloWorldDefaults.prompt2 || 'How are you today?',
        suggestion: helloWorldDefaults.prompt2 || 'How are you today?'
      },
      {
        question: "What should the response be semantically similar to?",
        key: 'semanticExpected' as keyof OnboardingData,
        placeholder: helloWorldDefaults.semanticExpected || "I'm doing well, thank you for asking",
        suggestion: helloWorldDefaults.semanticExpected || "I'm doing well, thank you for asking"
      },
      {
        question: "Semantic similarity threshold (0.0-1.0)?",
        key: 'semanticThreshold' as keyof OnboardingData,
        placeholder: String(helloWorldDefaults.semanticThreshold || 0.7),
        suggestion: helloWorldDefaults.semanticThreshold || 0.7
      },
      {
        question: "What criteria should the LLM judge use for second eval?",
        key: 'judgeCriteria2' as keyof OnboardingData,
        placeholder: helloWorldDefaults.judgeCriteria2 || "Is this a friendly and appropriate response to 'How are you today?'?",
        suggestion: helloWorldDefaults.judgeCriteria2 || "Is this a friendly and appropriate response to 'How are you today?'?"
      },
      {
        question: "Minimum tokens for second eval?",
        key: 'minTokens2' as keyof OnboardingData,
        placeholder: String(helloWorldDefaults.minTokens2 || 10),
        suggestion: helloWorldDefaults.minTokens2 || 10
      },
      {
        question: "Maximum tokens for second eval?",
        key: 'maxTokens2' as keyof OnboardingData,
        placeholder: String(helloWorldDefaults.maxTokens2 || 100),
        suggestion: helloWorldDefaults.maxTokens2 || 100
      },
      {
        question: "Third eval: What should we ask the AI?",
        key: 'prompt3' as keyof OnboardingData,
        placeholder: helloWorldDefaults.prompt3 || 'What is 2+2?',
        suggestion: helloWorldDefaults.prompt3 || 'What is 2+2?'
      },
      {
        question: "What should be in the response? (match pattern)",
        key: 'match3' as keyof OnboardingData,
        placeholder: helloWorldDefaults.match3 || '*4*',
        suggestion: helloWorldDefaults.match3 || '*4*'
      },
      {
        question: "What criteria should the LLM judge use for third eval?",
        key: 'judgeCriteria3' as keyof OnboardingData,
        placeholder: helloWorldDefaults.judgeCriteria3 || "Is this a correct mathematical answer to 2+2?",
        suggestion: helloWorldDefaults.judgeCriteria3 || "Is this a correct mathematical answer to 2+2?"
      },
      {
        question: "Minimum tokens for third eval?",
        key: 'minTokens3' as keyof OnboardingData,
        placeholder: String(helloWorldDefaults.minTokens3 || 1),
        suggestion: helloWorldDefaults.minTokens3 || 1
      },
      {
        question: "Maximum tokens for third eval?",
        key: 'maxTokens3' as keyof OnboardingData,
        placeholder: String(helloWorldDefaults.maxTokens3 || 20),
        suggestion: helloWorldDefaults.maxTokens3 || 20
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
        lines.push('{gray-fg}Tip: Press Ctrl-C or Ctrl-D to cancel{/gray-fg}');
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
        lines.push('{green-fg}Starting your first vibe check now...{/green-fg}');
        lines.push('{gray-fg}Tip: Re-run anytime with :check or :check <file>{/gray-fg}');
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
        // Convert numeric fields to numbers
        if (step.key.includes('Tokens') || step.key === 'semanticThreshold') {
          const numValue = parseFloat(trimmed);
          (data as any)[step.key] = isNaN(numValue) ? trimmed : numValue;
        } else {
          (data as any)[step.key] = trimmed;
        }
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

  // Eval 1: Say Hello
  lines.push('{gray-fg}  - prompt:{/gray-fg} ' + (data.prompt1 ? `{cyan-fg}${data.prompt1}{/cyan-fg}` : '{gray-fg}<prompt1>{/gray-fg}'));
  lines.push('{gray-fg}    checks:{/gray-fg}');
  lines.push('{gray-fg}      match:{/gray-fg} ' + (data.match1 ? `{cyan-fg}${data.match1}{/cyan-fg}` : '{gray-fg}<match1>{/gray-fg}'));
  lines.push('{gray-fg}      min_tokens:{/gray-fg} ' + (data.minTokens1 ? `{cyan-fg}${data.minTokens1}{/cyan-fg}` : '{gray-fg}<min_tokens1>{/gray-fg}'));
  lines.push('{gray-fg}      max_tokens:{/gray-fg} ' + (data.maxTokens1 ? `{cyan-fg}${data.maxTokens1}{/cyan-fg}` : '{gray-fg}<max_tokens1>{/gray-fg}'));

  // Eval 2: How are you today?
  lines.push('{gray-fg}  - prompt:{/gray-fg} ' + (data.prompt2 ? `{cyan-fg}${data.prompt2}{/cyan-fg}` : '{gray-fg}<prompt2>{/gray-fg}'));
  lines.push('{gray-fg}    checks:{/gray-fg}');
  lines.push('{gray-fg}      semantic:{/gray-fg}');
  lines.push('{gray-fg}        expected:{/gray-fg} ' + (data.semanticExpected ? `{cyan-fg}${data.semanticExpected}{/cyan-fg}` : '{gray-fg}<semantic_expected>{/gray-fg}'));
  lines.push('{gray-fg}        threshold:{/gray-fg} ' + (data.semanticThreshold ? `{cyan-fg}${data.semanticThreshold}{/cyan-fg}` : '{gray-fg}<threshold>{/gray-fg}'));
  lines.push('{gray-fg}      llm_judge:{/gray-fg}');
  lines.push('{gray-fg}        criteria:{/gray-fg} ' + (data.judgeCriteria2 ? `{cyan-fg}${data.judgeCriteria2}{/cyan-fg}` : '{gray-fg}<judge_criteria2>{/gray-fg}'));
  lines.push('{gray-fg}      min_tokens:{/gray-fg} ' + (data.minTokens2 ? `{cyan-fg}${data.minTokens2}{/cyan-fg}` : '{gray-fg}<min_tokens2>{/gray-fg}'));
  lines.push('{gray-fg}      max_tokens:{/gray-fg} ' + (data.maxTokens2 ? `{cyan-fg}${data.maxTokens2}{/cyan-fg}` : '{gray-fg}<max_tokens2>{/gray-fg}'));

  // Eval 3: What is 2+2?
  lines.push('{gray-fg}  - prompt:{/gray-fg} ' + (data.prompt3 ? `{cyan-fg}${data.prompt3}{/cyan-fg}` : '{gray-fg}<prompt3>{/gray-fg}'));
  lines.push('{gray-fg}    checks:{/gray-fg}');
  lines.push('{gray-fg}      match:{/gray-fg} ' + (data.match3 ? `{cyan-fg}${data.match3}{/cyan-fg}` : '{gray-fg}<match3>{/gray-fg}'));
  lines.push('{gray-fg}      llm_judge:{/gray-fg}');
  lines.push('{gray-fg}        criteria:{/gray-fg} ' + (data.judgeCriteria3 ? `{cyan-fg}${data.judgeCriteria3}{/cyan-fg}` : '{gray-fg}<judge_criteria3>{/gray-fg}'));
  lines.push('{gray-fg}      min_tokens:{/gray-fg} ' + (data.minTokens3 ? `{cyan-fg}${data.minTokens3}{/cyan-fg}` : '{gray-fg}<min_tokens3>{/gray-fg}'));
  lines.push('{gray-fg}      max_tokens:{/gray-fg} ' + (data.maxTokens3 ? `{cyan-fg}${data.maxTokens3}{/cyan-fg}` : '{gray-fg}<max_tokens3>{/gray-fg}'));

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
        prompt: data.prompt1,
        checks: {
          match: data.match1,
          min_tokens: data.minTokens1,
          max_tokens: data.maxTokens1
        }
      },
      {
        prompt: data.prompt2,
        checks: {
          semantic: {
            expected: data.semanticExpected,
            threshold: data.semanticThreshold
          },
          llm_judge: {
            criteria: data.judgeCriteria2
          },
          min_tokens: data.minTokens2,
          max_tokens: data.maxTokens2
        }
      },
      {
        prompt: data.prompt3,
        checks: {
          match: data.match3,
          llm_judge: {
            criteria: data.judgeCriteria3
          },
          min_tokens: data.minTokens3,
          max_tokens: data.maxTokens3
        }
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
  
  // Eval 1: Say Hello
  lines.push(`{gray-fg}  - prompt:{/gray-fg} {cyan-fg}${data.prompt1}{/cyan-fg}`);
  lines.push('{gray-fg}    checks:{/gray-fg}');
  lines.push(`{gray-fg}      match:{/gray-fg} {cyan-fg}${data.match1}{/cyan-fg}`);
  lines.push(`{gray-fg}      min_tokens:{/gray-fg} {cyan-fg}${data.minTokens1}{/cyan-fg}`);
  lines.push(`{gray-fg}      max_tokens:{/gray-fg} {cyan-fg}${data.maxTokens1}{/cyan-fg}`);

  // Eval 2: How are you today?
  lines.push(`{gray-fg}  - prompt:{/gray-fg} {cyan-fg}${data.prompt2}{/cyan-fg}`);
  lines.push('{gray-fg}    checks:{/gray-fg}');
  lines.push('{gray-fg}      semantic:{/gray-fg}');
  lines.push(`{gray-fg}        expected:{/gray-fg} {cyan-fg}${data.semanticExpected}{/cyan-fg}`);
  lines.push(`{gray-fg}        threshold:{/gray-fg} {cyan-fg}${data.semanticThreshold}{/cyan-fg}`);
  lines.push('{gray-fg}      llm_judge:{/gray-fg}');
  lines.push(`{gray-fg}        criteria:{/gray-fg} {cyan-fg}${data.judgeCriteria2}{/cyan-fg}`);
  lines.push(`{gray-fg}      min_tokens:{/gray-fg} {cyan-fg}${data.minTokens2}{/cyan-fg}`);
  lines.push(`{gray-fg}      max_tokens:{/gray-fg} {cyan-fg}${data.maxTokens2}{/cyan-fg}`);

  // Eval 3: What is 2+2?
  lines.push(`{gray-fg}  - prompt:{/gray-fg} {cyan-fg}${data.prompt3}{/cyan-fg}`);
  lines.push('{gray-fg}    checks:{/gray-fg}');
  lines.push(`{gray-fg}      match:{/gray-fg} {cyan-fg}${data.match3}{/cyan-fg}`);
  lines.push('{gray-fg}      llm_judge:{/gray-fg}');
  lines.push(`{gray-fg}        criteria:{/gray-fg} {cyan-fg}${data.judgeCriteria3}{/cyan-fg}`);
  lines.push(`{gray-fg}      min_tokens:{/gray-fg} {cyan-fg}${data.minTokens3}{/cyan-fg}`);
  lines.push(`{gray-fg}      max_tokens:{/gray-fg} {cyan-fg}${data.maxTokens3}{/cyan-fg}`);

  return lines.join('\n');
}
