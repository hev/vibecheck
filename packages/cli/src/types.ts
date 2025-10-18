import { z } from 'zod';

// New property-based checks schema
export const ChecksSchema = z.object({
  match: z.union([z.string(), z.array(z.string())]).optional(),
  not_match: z.union([z.string(), z.array(z.string())]).optional(),
  or: z.array(z.object({ match: z.string() })).optional(),
  min_tokens: z.number().optional(),
  max_tokens: z.number().optional(),
  semantic: z.object({
    expected: z.string(),
    threshold: z.number().min(0).max(1)
  }).optional(),
  llm_judge: z.object({
    criteria: z.string()
  }).optional()
}).strict(); // Add strict mode to reject unknown properties

export const EvalSchema = z.object({
  prompt: z.string(),
  checks: ChecksSchema  // Changed from array to object
});

export const MCPServerSchema = z.object({
  url: z.string(),
  name: z.string(),
  authorization_token: z.string().optional()
});

export const EvalSuiteMetadataSchema = z.object({
  name: z.string(),
  model: z.string(),
  system_prompt: z.string().optional(),  // Make optional
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
}

export interface EvalResult {
  evalName: string;
  prompt: string;
  response: string;
  checkResults: ConditionalResult[];
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
