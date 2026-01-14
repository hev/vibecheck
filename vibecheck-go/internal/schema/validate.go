package schema

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// ValidationError represents a validation error with context
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	if e.Field != "" {
		return fmt.Sprintf("%s: %s", e.Field, e.Message)
	}
	return e.Message
}

// LoadSuiteFromFile loads and validates an evaluation suite from a YAML file
func LoadSuiteFromFile(path string) (*EvalSuite, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	return ParseSuite(data)
}

// ParseSuite parses and validates an evaluation suite from YAML data
func ParseSuite(data []byte) (*EvalSuite, error) {
	var suite EvalSuite
	if err := yaml.Unmarshal(data, &suite); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	if err := ValidateSuite(&suite); err != nil {
		return nil, err
	}

	return &suite, nil
}

// ValidateSuite validates an evaluation suite
func ValidateSuite(suite *EvalSuite) error {
	var errors []string

	// Validate metadata
	if suite.Metadata.Name == "" {
		errors = append(errors, "metadata.name is required")
	}
	if suite.Metadata.Model == "" {
		errors = append(errors, "metadata.model is required")
	}

	// Validate MCP server if present
	if suite.Metadata.MCPServer != nil {
		if suite.Metadata.MCPServer.URL == "" {
			errors = append(errors, "metadata.mcp_server.url is required")
		}
		if suite.Metadata.MCPServer.Name == "" {
			errors = append(errors, "metadata.mcp_server.name is required")
		}
	}

	// Validate evals
	if len(suite.Evals) == 0 {
		errors = append(errors, "at least one eval is required")
	}

	for i, eval := range suite.Evals {
		evalPrefix := fmt.Sprintf("evals[%d]", i)

		if eval.Prompt == "" {
			errors = append(errors, fmt.Sprintf("%s.prompt is required", evalPrefix))
		}

		if eval.Checks.IsEmpty() {
			errors = append(errors, fmt.Sprintf("%s.checks cannot be empty", evalPrefix))
		}

		// Validate each check
		for j, check := range eval.Checks.Items {
			checkPrefix := fmt.Sprintf("%s.checks[%d]", evalPrefix, j)
			if err := validateCheck(&check, checkPrefix); err != nil {
				errors = append(errors, err.Error())
			}
		}
	}

	if len(errors) > 0 {
		return &ValidationError{
			Message: "validation failed:\n  - " + strings.Join(errors, "\n  - "),
		}
	}

	return nil
}

// validateCheck validates a single check
func validateCheck(check *Check, prefix string) error {
	// Count how many check types are set
	count := 0
	if check.Match != "" {
		count++
	}
	if check.NotMatch != "" {
		count++
	}
	if check.MinTokens > 0 {
		count++
	}
	if check.MaxTokens > 0 {
		count++
	}
	if check.Semantic != nil {
		count++
	}
	if check.LLMJudge != nil {
		count++
	}
	if len(check.Or) > 0 {
		count++
	}

	if count == 0 {
		return &ValidationError{
			Field:   prefix,
			Message: "check must have at least one condition",
		}
	}

	if count > 1 {
		return &ValidationError{
			Field:   prefix,
			Message: "check must have exactly one condition type",
		}
	}

	// Validate semantic check
	if check.Semantic != nil {
		if check.Semantic.Expected == "" {
			return &ValidationError{
				Field:   prefix + ".semantic.expected",
				Message: "expected value is required",
			}
		}
		if check.Semantic.Threshold < 0 || check.Semantic.Threshold > 1 {
			return &ValidationError{
				Field:   prefix + ".semantic.threshold",
				Message: "threshold must be between 0 and 1",
			}
		}
	}

	// Validate LLM judge check
	if check.LLMJudge != nil {
		if check.LLMJudge.Criteria == "" {
			return &ValidationError{
				Field:   prefix + ".llm_judge.criteria",
				Message: "criteria is required",
			}
		}
	}

	// Validate nested OR checks
	for i, orCheck := range check.Or {
		orPrefix := fmt.Sprintf("%s.or[%d]", prefix, i)
		if err := validateCheck(&orCheck, orPrefix); err != nil {
			return err
		}
	}

	return nil
}

// DetectEvalFile auto-detects an eval file in the current directory
func DetectEvalFile() string {
	candidates := []string{
		"evals.yaml",
		"eval.yaml",
		"evals.yml",
		"eval.yml",
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	return ""
}

// IsLegacyFormat checks if the YAML data uses a legacy format
// and returns a migration message if so
func IsLegacyFormat(data []byte) (bool, string) {
	// Parse as generic YAML to check structure
	var raw map[string]interface{}
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return false, ""
	}

	// Check for legacy field names or structures
	// This can be extended as needed based on actual legacy formats
	if _, ok := raw["tests"]; ok {
		return true, "Legacy format detected: 'tests' should be renamed to 'evals'"
	}

	if _, ok := raw["config"]; ok {
		return true, "Legacy format detected: 'config' should be renamed to 'metadata'"
	}

	return false, ""
}
