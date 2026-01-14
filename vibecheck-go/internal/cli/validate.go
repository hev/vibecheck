package cli

import (
	"fmt"
	"os"

	"github.com/hev/vibecheck/internal/display"
	"github.com/hev/vibecheck/internal/schema"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var validateCmd = &cobra.Command{
	Use:   "validate [file]",
	Short: "Validate an evaluation YAML file without running it",
	Long: `Validate an evaluation YAML file without running it.

Examples:
  $ vibe validate                          Validate auto-detected eval file (evals.yaml, eval.yaml, etc.)
  $ vibe validate my-eval.yaml             Validate a specific YAML file
  $ vibe validate examples/hello-world.yaml  Validate an example file`,
	Args: cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var file string
		if len(args) > 0 {
			file = args[0]
		}
		runValidate(file)
	},
}

func init() {
	rootCmd.AddCommand(validateCmd)
}

func runValidate(file string) {
	// Auto-detect file if not provided
	targetFile := file
	if targetFile == "" {
		DebugLog("No file specified, attempting auto-detection...")
		targetFile = schema.DetectEvalFile()
		if targetFile != "" {
			DebugLog("Auto-detected file: %s", targetFile)
		}
	}

	if targetFile == "" {
		display.Error("Error: No evaluation file found")
		display.Gray("Please specify a file with: vibe validate <file>")
		display.Gray("Or create one of: evals.yaml, eval.yaml, evals.yml, eval.yml")
		os.Exit(1)
	}

	spinner := display.NewSpinner(fmt.Sprintf("Validating %s...", targetFile))
	spinner.Start()

	// Check if file exists
	if _, err := os.Stat(targetFile); os.IsNotExist(err) {
		spinner.Fail(fmt.Sprintf("File not found: %s", targetFile))
		os.Exit(1)
	}

	// Read file content
	data, err := os.ReadFile(targetFile)
	if err != nil {
		spinner.Fail(fmt.Sprintf("Failed to read file: %s", err))
		os.Exit(1)
	}

	// Check for legacy format first
	if isLegacy, msg := checkLegacyFormat(data); isLegacy {
		spinner.Fail("Invalid or legacy format detected")
		display.Error("\nThe object-based checks format is no longer supported.")
		display.Error("Please update your YAML file to use the new array-based format.\n")
		display.Warn("Migration Guide:")
		display.Gray("\nOld format (object-based):")
		display.Gray("  checks:")
		display.Gray("    match: \"*hello*\"")
		display.Gray("    min_tokens: 1")
		display.Gray("    max_tokens: 50")
		display.Gray("\nNew format (array-based for AND):")
		display.Gray("  checks:")
		display.Gray("    - match: \"*hello*\"")
		display.Gray("    - min_tokens: 1")
		display.Gray("    - max_tokens: 50")
		display.Gray("\nFor OR checks, use:")
		display.Gray("  checks:")
		display.Gray("    or:")
		display.Gray("      - match: \"*option1*\"")
		display.Gray("      - match: \"*option2*\"")
		display.Gray("\nSee CLI docs for more details.")
		if msg != "" {
			DebugLog("Legacy format message: %s", msg)
		}
		os.Exit(1)
	}

	// Parse and validate
	suite, err := schema.ParseSuite(data)
	if err != nil {
		spinner.Fail("Invalid YAML format")
		display.Error("\n%s", err)
		os.Exit(1)
	}

	spinner.Success(fmt.Sprintf("✓ Valid evaluation suite: %s", targetFile))

	// Display summary information
	fmt.Println()
	display.Info("Suite Information:")
	display.Gray("  Name: %s", suite.Metadata.Name)
	display.Gray("  Model: %s", suite.Metadata.Model)
	if suite.Metadata.SystemPrompt != "" {
		display.Gray("  System Prompt: ✓")
	} else {
		display.Gray("  System Prompt: ✗ (optional)")
	}
	display.Gray("  Evaluations: %d", len(suite.Evals))

	if suite.Metadata.MCPServer != nil {
		display.Gray("  MCP Server: %s", suite.Metadata.MCPServer.URL)
	}

	// Warning for missing system_prompt
	if suite.Metadata.SystemPrompt == "" {
		fmt.Println()
		display.Warn("⚠️  Note: system_prompt is optional but recommended for better results")
	}
}

// checkLegacyFormat checks if the YAML uses the legacy object-based checks format
func checkLegacyFormat(data []byte) (bool, string) {
	var raw map[string]interface{}
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return false, ""
	}

	// Check for legacy 'tests' or 'config' keys
	if isLegacy, msg := schema.IsLegacyFormat(data); isLegacy {
		return true, msg
	}

	// Check for legacy object-based checks format
	evalsRaw, ok := raw["evals"]
	if !ok {
		return false, ""
	}

	evals, ok := evalsRaw.([]interface{})
	if !ok {
		return false, ""
	}

	legacyKeys := []string{"match", "not_match", "min_tokens", "max_tokens", "semantic", "llm_judge"}

	for _, evalRaw := range evals {
		evalMap, ok := evalRaw.(map[string]interface{})
		if !ok {
			continue
		}

		checksRaw, ok := evalMap["checks"]
		if !ok {
			continue
		}

		checksMap, ok := checksRaw.(map[string]interface{})
		if !ok {
			continue // Array format or {or: [...]} is fine
		}

		// If checks is a map and doesn't have 'or' key, check for legacy format
		if _, hasOr := checksMap["or"]; hasOr {
			continue // {or: [...]} format is valid
		}

		// Check if it has any legacy property keys directly
		for _, key := range legacyKeys {
			if _, exists := checksMap[key]; exists {
				return true, "checks uses object-based format instead of array-based"
			}
		}
	}

	return false, ""
}
