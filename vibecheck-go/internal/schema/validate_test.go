package schema

import (
	"testing"
)

func TestParseSuite_ValidMinimal(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: What is 2+2?
    checks:
      - match: "*4*"
`
	suite, err := ParseSuite([]byte(yaml))
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if suite.Metadata.Name != "test-suite" {
		t.Errorf("expected name 'test-suite', got '%s'", suite.Metadata.Name)
	}
	if suite.Metadata.Model != "anthropic/claude-3.5-sonnet" {
		t.Errorf("expected model 'anthropic/claude-3.5-sonnet', got '%s'", suite.Metadata.Model)
	}
	if len(suite.Evals) != 1 {
		t.Errorf("expected 1 eval, got %d", len(suite.Evals))
	}
}

func TestParseSuite_ValidWithSystemPrompt(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: openai/gpt-4
  system_prompt: You are a helpful assistant.
evals:
  - prompt: Hello
    checks:
      - match: "*hello*"
`
	suite, err := ParseSuite([]byte(yaml))
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if suite.Metadata.SystemPrompt != "You are a helpful assistant." {
		t.Errorf("expected system prompt, got '%s'", suite.Metadata.SystemPrompt)
	}
}

func TestParseSuite_ValidWithMCPServer(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
  mcp_server:
    url: https://example.com/mcp
    name: my-server
    authorization_token: secret-token
evals:
  - prompt: Test
    checks:
      - match: "*pass*"
`
	suite, err := ParseSuite([]byte(yaml))
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if suite.Metadata.MCPServer == nil {
		t.Fatal("expected MCP server config")
	}
	if suite.Metadata.MCPServer.URL != "https://example.com/mcp" {
		t.Errorf("expected MCP URL, got '%s'", suite.Metadata.MCPServer.URL)
	}
	if suite.Metadata.MCPServer.Name != "my-server" {
		t.Errorf("expected MCP name, got '%s'", suite.Metadata.MCPServer.Name)
	}
}

func TestParseSuite_MissingName(t *testing.T) {
	yaml := `
metadata:
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Test
    checks:
      - match: "*test*"
`
	_, err := ParseSuite([]byte(yaml))
	if err == nil {
		t.Fatal("expected validation error for missing name")
	}
}

func TestParseSuite_MissingModel(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
evals:
  - prompt: Test
    checks:
      - match: "*test*"
`
	_, err := ParseSuite([]byte(yaml))
	if err == nil {
		t.Fatal("expected validation error for missing model")
	}
}

func TestParseSuite_MissingEvals(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals: []
`
	_, err := ParseSuite([]byte(yaml))
	if err == nil {
		t.Fatal("expected validation error for empty evals")
	}
}

func TestParseSuite_MissingPrompt(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - checks:
      - match: "*test*"
`
	_, err := ParseSuite([]byte(yaml))
	if err == nil {
		t.Fatal("expected validation error for missing prompt")
	}
}

func TestParseSuite_EmptyChecks(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Test
    checks: []
`
	_, err := ParseSuite([]byte(yaml))
	if err == nil {
		t.Fatal("expected validation error for empty checks")
	}
}

func TestParseSuite_MatchCheck(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: What is the capital?
    checks:
      - match: "*Paris*"
`
	suite, err := ParseSuite([]byte(yaml))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(suite.Evals[0].Checks.Items) != 1 {
		t.Fatalf("expected 1 check, got %d", len(suite.Evals[0].Checks.Items))
	}
	if suite.Evals[0].Checks.Items[0].Match != "*Paris*" {
		t.Errorf("expected match '*Paris*', got '%s'", suite.Evals[0].Checks.Items[0].Match)
	}
}

func TestParseSuite_NotMatchCheck(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: What is the capital?
    checks:
      - not_match: "*London*"
`
	suite, err := ParseSuite([]byte(yaml))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if suite.Evals[0].Checks.Items[0].NotMatch != "*London*" {
		t.Errorf("expected not_match '*London*', got '%s'", suite.Evals[0].Checks.Items[0].NotMatch)
	}
}

func TestParseSuite_TokenChecks(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Write a short response
    checks:
      - min_tokens: 10
  - prompt: Write a brief response
    checks:
      - max_tokens: 100
`
	suite, err := ParseSuite([]byte(yaml))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if suite.Evals[0].Checks.Items[0].MinTokens != 10 {
		t.Errorf("expected min_tokens 10, got %d", suite.Evals[0].Checks.Items[0].MinTokens)
	}
	if suite.Evals[1].Checks.Items[0].MaxTokens != 100 {
		t.Errorf("expected max_tokens 100, got %d", suite.Evals[1].Checks.Items[0].MaxTokens)
	}
}

func TestParseSuite_SemanticCheck(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Describe happiness
    checks:
      - semantic:
          expected: A positive emotional state
          threshold: 0.8
`
	suite, err := ParseSuite([]byte(yaml))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	check := suite.Evals[0].Checks.Items[0]
	if check.Semantic == nil {
		t.Fatal("expected semantic check")
	}
	if check.Semantic.Expected != "A positive emotional state" {
		t.Errorf("expected semantic.expected value")
	}
	if check.Semantic.Threshold != 0.8 {
		t.Errorf("expected threshold 0.8, got %f", check.Semantic.Threshold)
	}
}

func TestParseSuite_SemanticCheckMissingExpected(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Test
    checks:
      - semantic:
          threshold: 0.8
`
	_, err := ParseSuite([]byte(yaml))
	if err == nil {
		t.Fatal("expected validation error for missing semantic.expected")
	}
}

func TestParseSuite_SemanticCheckInvalidThreshold(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Test
    checks:
      - semantic:
          expected: test
          threshold: 1.5
`
	_, err := ParseSuite([]byte(yaml))
	if err == nil {
		t.Fatal("expected validation error for invalid threshold")
	}
}

func TestParseSuite_LLMJudgeCheck(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Write a poem
    checks:
      - llm_judge:
          criteria: The response should be creative and poetic
`
	suite, err := ParseSuite([]byte(yaml))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	check := suite.Evals[0].Checks.Items[0]
	if check.LLMJudge == nil {
		t.Fatal("expected llm_judge check")
	}
	if check.LLMJudge.Criteria != "The response should be creative and poetic" {
		t.Errorf("expected llm_judge.criteria value")
	}
}

func TestParseSuite_LLMJudgeMissingCriteria(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Test
    checks:
      - llm_judge:
          model: gpt-4
`
	_, err := ParseSuite([]byte(yaml))
	if err == nil {
		t.Fatal("expected validation error for missing llm_judge.criteria")
	}
}

func TestParseSuite_OrChecks(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Say yes or ok
    checks:
      - or:
          - match: "*yes*"
          - match: "*ok*"
`
	suite, err := ParseSuite([]byte(yaml))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	check := suite.Evals[0].Checks.Items[0]
	if len(check.Or) != 2 {
		t.Fatalf("expected 2 OR checks, got %d", len(check.Or))
	}
	if check.Or[0].Match != "*yes*" {
		t.Errorf("expected first OR check match '*yes*'")
	}
	if check.Or[1].Match != "*ok*" {
		t.Errorf("expected second OR check match '*ok*'")
	}
}

func TestParseSuite_MultipleChecksAND(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
evals:
  - prompt: Give a detailed answer
    checks:
      - match: "*answer*"
      - min_tokens: 50
`
	suite, err := ParseSuite([]byte(yaml))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(suite.Evals[0].Checks.Items) != 2 {
		t.Fatalf("expected 2 checks (AND), got %d", len(suite.Evals[0].Checks.Items))
	}
	if suite.Evals[0].Checks.IsOr {
		t.Error("expected checks to be AND (not OR)")
	}
}

func TestIsLegacyFormat_Tests(t *testing.T) {
	yaml := `
tests:
  - prompt: Test
`
	isLegacy, msg := IsLegacyFormat([]byte(yaml))
	if !isLegacy {
		t.Error("expected legacy format detection for 'tests' key")
	}
	if msg == "" {
		t.Error("expected migration message")
	}
}

func TestIsLegacyFormat_Config(t *testing.T) {
	yaml := `
config:
  name: test
`
	isLegacy, msg := IsLegacyFormat([]byte(yaml))
	if !isLegacy {
		t.Error("expected legacy format detection for 'config' key")
	}
	if msg == "" {
		t.Error("expected migration message")
	}
}

func TestIsLegacyFormat_CurrentFormat(t *testing.T) {
	yaml := `
metadata:
  name: test-suite
  model: test-model
evals:
  - prompt: test
`
	isLegacy, _ := IsLegacyFormat([]byte(yaml))
	if isLegacy {
		t.Error("current format should not be detected as legacy")
	}
}

func TestValidationError_Error(t *testing.T) {
	err := &ValidationError{Field: "test.field", Message: "is invalid"}
	expected := "test.field: is invalid"
	if err.Error() != expected {
		t.Errorf("expected '%s', got '%s'", expected, err.Error())
	}

	err2 := &ValidationError{Message: "general error"}
	if err2.Error() != "general error" {
		t.Errorf("expected 'general error', got '%s'", err2.Error())
	}
}
