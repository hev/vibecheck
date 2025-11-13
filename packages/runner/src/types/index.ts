import { z } from 'zod';

// Individual check schemas (each check is a single-property object)
const MatchCheckSchema = z.object({
  match: z.string().min(1, "pattern cannot be empty")
}).strict();

const NotMatchCheckSchema = z.object({
  not_match: z.string().min(1, "pattern cannot be empty")
}).strict();

const MinTokensCheckSchema = z.object({
  min_tokens: z.number()
}).strict();

const MaxTokensCheckSchema = z.object({
  max_tokens: z.number()
}).strict();

const SemanticCheckSchema = z.object({
  semantic: z.object({
    expected: z.string(),
    threshold: z.number().min(0).max(1)
  })
}).strict();

const LLMJudgeCheckSchema = z.object({
  llm_judge: z.object({
    criteria: z.string()
  })
}).strict();

// Union of all check types (each check is a single-property object)
const CheckSchema = z.union([
  MatchCheckSchema,
  NotMatchCheckSchema,
  MinTokensCheckSchema,
  MaxTokensCheckSchema,
  SemanticCheckSchema,
  LLMJudgeCheckSchema
]);

// Checks can be an array (AND) or an object with 'or' property (OR)
export const ChecksSchema = z.union([
  z.array(CheckSchema),
  z.object({
    or: z.array(CheckSchema).min(1, "OR checks must have at least one check")
  }).strict()
]).refine(
  (val) => {
    if (Array.isArray(val)) {
      return val.length > 0;
    }
    return true; // OR format is validated above
  },
  { message: "checks array cannot be empty" }
);

export const EvalSchema = z.object({
  prompt: z.string(),
  checks: ChecksSchema
});

export const MCPServerSchema = z.object({
  url: z.string(),
  name: z.string(),
  authorization_token: z.string().optional()
});

export const EvalSuiteMetadataSchema = z.object({
  name: z.string(),
  model: z.string(),
  system_prompt: z.string().optional(),
  threads: z.number().optional(),
  mcp_server: MCPServerSchema.optional()
});

export const EvalSuiteSchema = z.object({
  metadata: EvalSuiteMetadataSchema,
  evals: z.array(EvalSchema)
});

export type Checks = z.infer<typeof ChecksSchema>;
export type Eval = z.infer<typeof EvalSchema>;
export type MCPServer = z.infer<typeof MCPServerSchema>;
export type EvalSuiteMetadata = z.infer<typeof EvalSuiteMetadataSchema>;
export type EvalSuite = z.infer<typeof EvalSuiteSchema>;

export interface ConditionalResult {
  type: string;
  passed: boolean;
  message: string;
  children?: ConditionalResult[];
}

export interface EvalResult {
  evalName: string;
  prompt: string;
  response: string;
  checkResults: ConditionalResult[];
  passed: boolean;
  executionTimeMs?: number;
  cost?: number;
}

export interface EvalRunResult {
  suiteId: string;
  suiteName: string;
  results: EvalResult[];
  totalTimeMs?: number;
}

// Runner configuration
export interface RunnerConfig {
  apiKey?: string;
  apiUrl?: string;
}

// Run options
export interface RunOptions {
  file?: string;
  suite?: EvalSuite;
  model?: string;
  models?: string[];
}

// API response types
export interface RunResponse {
  runId: string;
  error?: string | { message: string };
}

export interface StatusResponse {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'partial_failure' | 'timed_out' | 'error';
  results?: EvalResult[];
  suiteName?: string;
  model?: string;
  systemPrompt?: string;
  totalTimeMs?: number;
  error?: string | { message: string };
}
