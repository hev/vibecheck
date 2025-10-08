import { z } from 'zod';

export const ConditionalTypeSchema = z.enum([
  'string_contains',
  'semantic_similarity',
  'llm_judge',
  'token_length'
]);

export const OperatorSchema = z.enum(['and', 'or']);

export const StringContainsConditionalSchema = z.object({
  type: z.literal('string_contains'),
  value: z.string(),
  operator: OperatorSchema
});

export const SemanticSimilarityConditionalSchema = z.object({
  type: z.literal('semantic_similarity'),
  expected: z.string(),
  threshold: z.number().min(0).max(1),
  operator: OperatorSchema
});

export const LLMJudgeConditionalSchema = z.object({
  type: z.literal('llm_judge'),
  criteria: z.string(),
  operator: OperatorSchema
});

export const TokenLengthConditionalSchema = z.object({
  type: z.literal('token_length'),
  min_tokens: z.number().optional(),
  max_tokens: z.number().optional(),
  operator: OperatorSchema
});

export const ConditionalSchema = z.discriminatedUnion('type', [
  StringContainsConditionalSchema,
  SemanticSimilarityConditionalSchema,
  LLMJudgeConditionalSchema,
  TokenLengthConditionalSchema
]);

export const EvalSchema = z.object({
  name: z.string(),
  prompt: z.string(),
  conditionals: z.array(ConditionalSchema)
});

export const MCPServerSchema = z.object({
  url: z.string(),
  name: z.string(),
  authorization_token: z.string().optional()
});

export const EvalSuiteMetadataSchema = z.object({
  name: z.string(),
  model: z.string(),
  system_prompt: z.string(),
  mcp_server: MCPServerSchema.optional()
});

export const EvalSuiteSchema = z.object({
  metadata: EvalSuiteMetadataSchema,
  evals: z.array(EvalSchema)
});

export type Conditional = z.infer<typeof ConditionalSchema>;
export type Eval = z.infer<typeof EvalSchema>;
export type MCPServer = z.infer<typeof MCPServerSchema>;
export type EvalSuiteMetadata = z.infer<typeof EvalSuiteMetadataSchema>;
export type EvalSuite = z.infer<typeof EvalSuiteSchema>;

export interface ConditionalResult {
  type: string;
  passed: boolean;
  message: string;
}

export interface EvalResult {
  evalName: string;
  prompt: string;
  response: string;
  conditionalResults: ConditionalResult[];
  passed: boolean;
  executionTimeMs?: number;
  cost?: number; // Retail price per token
}

export interface EvalRunResult {
  suiteId: string;
  suiteName: string;
  results: EvalResult[];
}

// MCP Tool types
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// OpenAI message types
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// MCP tool call types
export interface MCPToolCallRequest {
  jsonrpc: '2.0';
  method: 'tools/call';
  id: string | number;
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

export interface MCPToolCallResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: {
    content: Array<{
      type: string;
      text?: string;
      [key: string]: any;
    }>;
  };
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}
