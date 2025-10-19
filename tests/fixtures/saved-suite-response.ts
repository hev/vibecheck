export const mockSavedSuiteResponse = {
  suite: {
    name: 'test-suite',
    yamlContent: `metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
  system_prompt: You are a helpful assistant.
  threads: 2
  mcp_server:
    url: https://example.com/mcp
    name: test-mcp-server
    authorization_token: test-token

evals:
  - prompt: Say hello
    checks:
      match: "*hello*"
      min_tokens: 1
      max_tokens: 50

  - prompt: What is 2+2?
    checks:
      match: "*4*"
      min_tokens: 1
      max_tokens: 20`
  }
};

export const mockSavedSuiteResponseMinimal = {
  suite: {
    name: 'minimal-suite',
    yamlContent: `metadata:
  name: minimal-suite
  model: openai/gpt-4

evals:
  - prompt: Test prompt
    checks:
      match: "*test*"`
  }
};

export const mockSavedSuiteResponseWithMCP = {
  suite: {
    name: 'mcp-suite',
    yamlContent: `metadata:
  name: mcp-suite
  model: anthropic/claude-3.5-sonnet
  system_prompt: You are a helpful assistant with MCP tools.
  mcp_server:
    url: https://mcp.example.com
    name: example-mcp
    authorization_token: secret-token

evals:
  - prompt: Use the calculator tool to compute 5 * 7
    checks:
      match: "*35*"
      llm_judge:
        criteria: "Did the assistant use the calculator tool correctly?"`
  }
};
