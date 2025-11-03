import * as yaml from 'js-yaml';
import { EvalSuiteSchema } from '../types';

// Mock the InteractiveUI for testing
class MockInteractiveUI {
  private data: any = {};
  private currentStep = 0;
  private steps: any[] = [];
  private onInput: ((input: string) => void) | null = null;

  setOnboardingHandler(handler: (input: string) => void) {
    this.onInput = handler;
  }

  simulateInput(input: string) {
    if (this.onInput) {
      this.onInput(input);
    }
  }

  setSteps(steps: any[]) {
    this.steps = steps;
  }

  setCurrentStep(step: number) {
    this.currentStep = step;
  }

  getData() {
    return this.data;
  }

  setData(data: any) {
    this.data = data;
  }
}

// Helper function to simulate the onboarding input handling
function simulateOnboardingInput(steps: any[], stepIndex: number, input: string): any {
  const data: any = {};
  const step = steps[stepIndex];

  // If empty, use the suggestion
  if (!input.trim()) {
    data[step.key] = step.suggestion;
  } else {
    // Convert numeric fields to numbers
    if (step.key.includes('Tokens') || step.key === 'semanticThreshold') {
      const numValue = parseFloat(input.trim());
      data[step.key] = isNaN(numValue) ? input.trim() : numValue;
    } else {
      data[step.key] = input.trim();
    }
  }

  return data;
}

// Helper function to generate YAML from onboarding data
function generateYAML(data: any): string {
  const evalSuite = {
    metadata: {
      name: data.name,
      model: data.model,
      system_prompt: data.systemPrompt
    },
    evals: [
      {
        prompt: data.prompt1,
        checks: [
          { match: data.match1 },
          { min_tokens: data.minTokens1 },
          { max_tokens: data.maxTokens1 }
        ]
      },
      {
        prompt: data.prompt2,
        checks: [
          {
            semantic: {
              expected: data.semanticExpected,
              threshold: data.semanticThreshold
            }
          },
          {
            llm_judge: {
              criteria: data.judgeCriteria2
            }
          },
          { min_tokens: data.minTokens2 },
          { max_tokens: data.maxTokens2 }
        ]
      },
      {
        prompt: data.prompt3,
        checks: [
          { match: data.match3 },
          {
            llm_judge: {
              criteria: data.judgeCriteria3
            }
          },
          { min_tokens: data.minTokens3 },
          { max_tokens: data.maxTokens3 }
        ]
      }
    ]
  };

  return yaml.dump(evalSuite, {
    indent: 2,
    lineWidth: -1
  });
}

describe('Onboarding YAML Generation', () => {
  const mockSteps = [
    {
      key: 'minTokens1',
      suggestion: 1
    },
    {
      key: 'maxTokens1', 
      suggestion: 50
    },
    {
      key: 'semanticThreshold',
      suggestion: 0.7
    },
    {
      key: 'minTokens2',
      suggestion: 10
    },
    {
      key: 'maxTokens2',
      suggestion: 100
    },
    {
      key: 'minTokens3',
      suggestion: 1
    },
    {
      key: 'maxTokens3',
      suggestion: 20
    }
  ];

  it('should generate numeric values for token fields when using defaults (empty input)', () => {
    const data: any = {
      name: 'test',
      model: 'test-model',
      systemPrompt: 'test prompt',
      prompt1: 'Say Hello',
      match1: '*hello*',
      prompt2: 'How are you?',
      semanticExpected: 'I am fine',
      judgeCriteria2: 'Is this friendly?',
      prompt3: 'What is 2+2?',
      match3: '*4*',
      judgeCriteria3: 'Is this correct?'
    };

    // Simulate pressing Enter for all numeric fields (empty input)
    data.minTokens1 = simulateOnboardingInput(mockSteps, 0, '').minTokens1;
    data.maxTokens1 = simulateOnboardingInput(mockSteps, 1, '').maxTokens1;
    data.semanticThreshold = simulateOnboardingInput(mockSteps, 2, '').semanticThreshold;
    data.minTokens2 = simulateOnboardingInput(mockSteps, 3, '').minTokens2;
    data.maxTokens2 = simulateOnboardingInput(mockSteps, 4, '').maxTokens2;
    data.minTokens3 = simulateOnboardingInput(mockSteps, 5, '').minTokens3;
    data.maxTokens3 = simulateOnboardingInput(mockSteps, 6, '').maxTokens3;
    
    const yamlContent = generateYAML(data);
    const parsed = yaml.load(yamlContent) as any;
    
    // Helper to find check by key in array
    const findCheck = (checks: any[], key: string) => checks.find(c => key in c)?.[key];
    
    // Verify all numeric fields are numbers, not strings
    expect(typeof findCheck(parsed.evals[0].checks, 'min_tokens')).toBe('number');
    expect(typeof findCheck(parsed.evals[0].checks, 'max_tokens')).toBe('number');
    expect(typeof findCheck(parsed.evals[1].checks, 'semantic')?.threshold).toBe('number');
    expect(typeof findCheck(parsed.evals[1].checks, 'min_tokens')).toBe('number');
    expect(typeof findCheck(parsed.evals[1].checks, 'max_tokens')).toBe('number');
    expect(typeof findCheck(parsed.evals[2].checks, 'min_tokens')).toBe('number');
    expect(typeof findCheck(parsed.evals[2].checks, 'max_tokens')).toBe('number');
  });
  
  it('should parse string inputs to numbers for numeric fields', () => {
    const data: any = {
      name: 'test',
      model: 'test-model',
      systemPrompt: 'test prompt',
      prompt1: 'Say Hello',
      match1: '*hello*',
      prompt2: 'How are you?',
      semanticExpected: 'I am fine',
      judgeCriteria2: 'Is this friendly?',
      prompt3: 'What is 2+2?',
      match3: '*4*',
      judgeCriteria3: 'Is this correct?'
    };

    // Simulate typing string values for numeric fields
    data.minTokens1 = simulateOnboardingInput(mockSteps, 0, '5').minTokens1;
    data.maxTokens1 = simulateOnboardingInput(mockSteps, 1, '75').maxTokens1;
    data.semanticThreshold = simulateOnboardingInput(mockSteps, 2, '0.8').semanticThreshold;
    data.minTokens2 = simulateOnboardingInput(mockSteps, 3, '15').minTokens2;
    data.maxTokens2 = simulateOnboardingInput(mockSteps, 4, '120').maxTokens2;
    data.minTokens3 = simulateOnboardingInput(mockSteps, 5, '2').minTokens3;
    data.maxTokens3 = simulateOnboardingInput(mockSteps, 6, '25').maxTokens3;
    
    const yamlContent = generateYAML(data);
    const parsed = yaml.load(yamlContent) as any;
    
    // Helper to find check by key in array
    const findCheck = (checks: any[], key: string) => checks.find(c => key in c)?.[key];
    
    // Verify all numeric fields are numbers, not strings
    expect(typeof findCheck(parsed.evals[0].checks, 'min_tokens')).toBe('number');
    expect(typeof findCheck(parsed.evals[0].checks, 'max_tokens')).toBe('number');
    expect(typeof findCheck(parsed.evals[1].checks, 'semantic')?.threshold).toBe('number');
    expect(typeof findCheck(parsed.evals[1].checks, 'min_tokens')).toBe('number');
    expect(typeof findCheck(parsed.evals[1].checks, 'max_tokens')).toBe('number');
    expect(typeof findCheck(parsed.evals[2].checks, 'min_tokens')).toBe('number');
    expect(typeof findCheck(parsed.evals[2].checks, 'max_tokens')).toBe('number');
    
    // Verify the actual values
    expect(findCheck(parsed.evals[0].checks, 'min_tokens')).toBe(5);
    expect(findCheck(parsed.evals[0].checks, 'max_tokens')).toBe(75);
    expect(findCheck(parsed.evals[1].checks, 'semantic')?.threshold).toBe(0.8);
    expect(findCheck(parsed.evals[1].checks, 'min_tokens')).toBe(15);
    expect(findCheck(parsed.evals[1].checks, 'max_tokens')).toBe(120);
    expect(findCheck(parsed.evals[2].checks, 'min_tokens')).toBe(2);
    expect(findCheck(parsed.evals[2].checks, 'max_tokens')).toBe(25);
  });

  it('should handle invalid numeric input gracefully', () => {
    const data: any = {
      name: 'test',
      model: 'test-model',
      systemPrompt: 'test prompt',
      prompt1: 'Say Hello',
      match1: '*hello*',
      prompt2: 'How are you?',
      semanticExpected: 'I am fine',
      judgeCriteria2: 'Is this friendly?',
      prompt3: 'What is 2+2?',
      match3: '*4*',
      judgeCriteria3: 'Is this correct?'
    };

    // Simulate typing invalid values for numeric fields
    data.minTokens1 = simulateOnboardingInput(mockSteps, 0, 'invalid').minTokens1;
    data.maxTokens1 = simulateOnboardingInput(mockSteps, 1, 'not-a-number').maxTokens1;
    data.semanticThreshold = simulateOnboardingInput(mockSteps, 2, 'also-invalid').semanticThreshold;
    
    const yamlContent = generateYAML(data);
    const parsed = yaml.load(yamlContent) as any;
    
    // Helper to find check by key in array
    const findCheck = (checks: any[], key: string) => checks.find(c => key in c)?.[key];
    
    // Invalid inputs should be stored as strings (fallback behavior)
    expect(typeof findCheck(parsed.evals[0].checks, 'min_tokens')).toBe('string');
    expect(typeof findCheck(parsed.evals[0].checks, 'max_tokens')).toBe('string');
    expect(typeof findCheck(parsed.evals[1].checks, 'semantic')?.threshold).toBe('string');
    
    expect(findCheck(parsed.evals[0].checks, 'min_tokens')).toBe('invalid');
    expect(findCheck(parsed.evals[0].checks, 'max_tokens')).toBe('not-a-number');
    expect(findCheck(parsed.evals[1].checks, 'semantic')?.threshold).toBe('also-invalid');
  });

  it('should validate generated YAML against schema', () => {
    const data: any = {
      name: 'test-suite',
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      systemPrompt: 'You are a helpful assistant.',
      prompt1: 'Say Hello',
      match1: '*hello*',
      minTokens1: 1,
      maxTokens1: 50,
      prompt2: 'How are you today?',
      semanticExpected: "I'm doing well, thank you for asking",
      semanticThreshold: 0.7,
      judgeCriteria2: "Is this a friendly and appropriate response to 'How are you today?'?",
      minTokens2: 10,
      maxTokens2: 100,
      prompt3: 'What is 2+2?',
      match3: '*4*',
      judgeCriteria3: "Is this a correct mathematical answer to 2+2?",
      minTokens3: 1,
      maxTokens3: 20
    };
    
    const yamlContent = generateYAML(data);
    const parsed = yaml.load(yamlContent);
    
    // Validate against the schema
    const parseResult = EvalSuiteSchema.safeParse(parsed);
    expect(parseResult.success).toBe(true);
  });
});