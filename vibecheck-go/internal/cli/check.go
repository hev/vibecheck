package cli

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/fatih/color"
	"github.com/hev/vibecheck/internal/api"
	"github.com/hev/vibecheck/internal/display"
	"github.com/hev/vibecheck/internal/schema"
	"github.com/spf13/cobra"
)

var (
	checkFile        string
	checkModel       string
	checkSystemPrompt string
	checkThreads     int
	checkMcpURL      string
	checkMcpName     string
	checkMcpToken    string
	checkMcp         bool
	checkPrice       string
	checkProvider    string
	checkAsync       bool
)

var checkCmd = &cobra.Command{
	Use:   "check [suite-name]",
	Short: "Check vibes by running evaluations from a YAML file or saved suite",
	Long: `Check vibes by running evaluations from a YAML file or saved suite.

Examples:
  $ vibe check -f examples/strawberry.yaml     Run evaluations from a local YAML file
  $ vibe check strawberry                      Run evaluations from a preloaded suite named "strawberry"
  $ vibe check -f my-eval.yaml --async         Run evaluations asynchronously (non-blocking)
  $ vibe check my-suite -m claude-3.5-sonnet   Run a suite with a different model`,
	Run: func(cmd *cobra.Command, args []string) {
		var suiteName string
		if len(args) > 0 {
			suiteName = args[0]
		}

		// Show help if no suite name and no file provided
		if suiteName == "" && checkFile == "" {
			cmd.Help()
			return
		}

		// Check for conflicts
		if suiteName != "" && checkFile != "" {
			display.Error("Error: Cannot specify both suite name and --file option")
			display.Gray("Use either: vibe check <suite-name> or vibe check -f <file>")
			os.Exit(1)
		}

		if suiteName != "" {
			runCheckSuite(suiteName)
		} else {
			runCheckFile()
		}
	},
}

func init() {
	checkCmd.Flags().StringVarP(&checkFile, "file", "f", "", "Path to the YAML file containing evaluations")
	checkCmd.Flags().StringVarP(&checkModel, "model", "m", "", "Override model from suite metadata")
	checkCmd.Flags().StringVarP(&checkSystemPrompt, "system-prompt", "s", "", "Override system prompt from suite metadata")
	checkCmd.Flags().IntVarP(&checkThreads, "threads", "t", 0, "Override thread count from suite metadata")
	checkCmd.Flags().StringVar(&checkMcpURL, "mcp-url", "", "Override or set MCP server URL")
	checkCmd.Flags().StringVar(&checkMcpName, "mcp-name", "", "Override or set MCP server name")
	checkCmd.Flags().StringVar(&checkMcpToken, "mcp-token", "", "Override or set MCP server authorization token")
	checkCmd.Flags().BoolVar(&checkMcp, "mcp", false, "Filter to only models with MCP support")
	checkCmd.Flags().StringVar(&checkPrice, "price", "", "Filter models by price quartiles")
	checkCmd.Flags().StringVar(&checkProvider, "provider", "", "Filter models by provider(s)")
	checkCmd.Flags().BoolVarP(&checkAsync, "async", "a", false, "Exit immediately after starting the run (non-blocking)")

	rootCmd.AddCommand(checkCmd)
}

func runCheckFile() {
	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	// Auto-detect file if not specified
	file := checkFile
	if file == "" {
		file = schema.DetectEvalFile()
		if file == "" {
			display.Error("Error: No evaluation file found")
			display.Gray("Please specify a file with -f <path> or create one of: evals.yaml, eval.yaml, evals.yml, eval.yml")
			os.Exit(1)
		}
		DebugLog("Auto-detected file: %s", file)
	}

	spinner := display.NewSpinner("Reading evaluation file...")
	spinner.Start()

	// Check if file exists
	if _, err := os.Stat(file); os.IsNotExist(err) {
		spinner.Fail(fmt.Sprintf("File not found: %s", file))
		os.Exit(1)
	}

	// Read file content
	yamlContent, err := os.ReadFile(file)
	if err != nil {
		spinner.Fail(fmt.Sprintf("Failed to read file: %s", err))
		os.Exit(1)
	}

	// Check for legacy format
	if isLegacy, _ := checkLegacyFormat(yamlContent); isLegacy {
		spinner.Fail("Invalid or legacy format detected")
		displayLegacyFormatError()
		os.Exit(1)
	}

	// Parse and validate
	suite, err := schema.ParseSuite(yamlContent)
	if err != nil {
		spinner.Fail("Invalid YAML format")
		display.Error("\n%s", err)
		os.Exit(1)
	}

	spinner.Success("Evaluation file loaded successfully")

	// Warning for missing system_prompt
	if suite.Metadata.SystemPrompt == "" {
		display.Warn("Warning: system_prompt is optional but recommended for better results")
	}

	// Prepare request payload
	requestPayload := map[string]interface{}{
		"evalSuite":   suite,
		"yamlContent": string(yamlContent),
	}

	DebugLog("Request to: /api/eval/run")
	DebugLog("Request payload: %+v", requestPayload)

	var response struct {
		RunID string `json:"runId"`
		Error string `json:"error,omitempty"`
	}

	err = client.Post("/api/eval/run", requestPayload, &response)
	if err != nil {
		display.Error("Failed to start evaluation")
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		display.Error("API Error: %s", response.Error)
		os.Exit(1)
	}

	runID := response.RunID

	// If async mode, exit immediately after starting the run
	if checkAsync {
		display.Success("Run started successfully!")
		display.Info("Run ID: %s", runID)
		display.Gray("\nCheck status with: vibe get run %s", runID)
		os.Exit(0)
	}

	display.Info("Running evaluation... Run ID: %s\n", runID)

	// Stream results using polling
	streamResults(client, runID, string(yamlContent))
}

func runCheckSuite(suiteName string) {
	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	spinner := display.NewSpinner(fmt.Sprintf("Fetching suite \"%s\"...", suiteName))
	spinner.Start()

	// Fetch suite from API
	var suiteResponse struct {
		Suite struct {
			Name        string `json:"name"`
			YamlContent string `json:"yamlContent"`
		} `json:"suite"`
		Error string `json:"error,omitempty"`
	}

	err := client.Get(fmt.Sprintf("/api/suite/%s", suiteName), &suiteResponse)
	if err != nil {
		spinner.Fail("Failed to fetch suite")
		if api.IsNotFoundError(err) {
			display.Error("\nSuite \"%s\" not found", suiteName)
			display.Gray("Use \"vibe get suites\" to list available suites")
		} else {
			handleAPIError(err)
		}
		os.Exit(1)
	}

	if suiteResponse.Error != "" {
		spinner.Fail(fmt.Sprintf("Error: %s", suiteResponse.Error))
		os.Exit(1)
	}

	spinner.UpdateMessage("Parsing suite...")

	// Parse the suite YAML
	suite, err := schema.ParseSuite([]byte(suiteResponse.Suite.YamlContent))
	if err != nil {
		spinner.Fail("Failed to parse suite YAML")
		display.Error("\n%s", err)
		os.Exit(1)
	}

	spinner.UpdateMessage("Applying overrides...")

	// Apply metadata overrides
	if checkModel != "" {
		suite.Metadata.Model = checkModel
	}
	if checkSystemPrompt != "" {
		suite.Metadata.SystemPrompt = checkSystemPrompt
	}
	if checkThreads > 0 {
		suite.Metadata.Threads = checkThreads
	}

	// Handle MCP server overrides
	if checkMcpURL != "" || checkMcpName != "" || checkMcpToken != "" {
		if suite.Metadata.MCPServer == nil {
			suite.Metadata.MCPServer = &schema.MCPServer{}
		}
		if checkMcpURL != "" {
			suite.Metadata.MCPServer.URL = checkMcpURL
		}
		if checkMcpName != "" {
			suite.Metadata.MCPServer.Name = checkMcpName
		}
		if checkMcpToken != "" {
			suite.Metadata.MCPServer.AuthorizationToken = checkMcpToken
		}
	}

	spinner.Success(fmt.Sprintf("Suite \"%s\" loaded successfully", suiteName))

	// Warning for missing system_prompt
	if suite.Metadata.SystemPrompt == "" {
		display.Warn("Warning: system_prompt is optional but recommended for better results")
	}

	// Prepare request payload
	requestPayload := map[string]interface{}{
		"evalSuite":   suite,
		"yamlContent": suiteResponse.Suite.YamlContent,
	}

	var response struct {
		RunID string `json:"runId"`
		Error string `json:"error,omitempty"`
	}

	err = client.Post("/api/eval/run", requestPayload, &response)
	if err != nil {
		display.Error("Failed to start evaluation")
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		display.Error("API Error: %s", response.Error)
		os.Exit(1)
	}

	runID := response.RunID

	// If async mode, exit immediately after starting the run
	if checkAsync {
		display.Success("Run started successfully!")
		display.Info("Run ID: %s", runID)
		display.Gray("\nCheck status with: vibe get run %s", runID)
		os.Exit(0)
	}

	display.Info("Running evaluation... Run ID: %s\n", runID)

	// Stream results using polling
	streamResults(client, runID, suiteResponse.Suite.YamlContent)
}

func streamResults(client *api.Client, runID string, yamlContent string) {
	pollInterval := 1 * time.Second
	completed := false
	lastDisplayedCount := 0
	headerDisplayed := false

	spinner := display.NewSpinner("Running evaluation...")
	spinner.Start()

	for !completed {
		var statusResponse struct {
			Status       string                  `json:"status"`
			Results      []schema.EvalResult     `json:"results"`
			IsUpdate     bool                    `json:"isUpdate"`
			SuiteName    string                  `json:"suiteName"`
			Model        string                  `json:"model"`
			SystemPrompt string                  `json:"systemPrompt"`
			TotalTimeMs  int64                   `json:"totalTimeMs"`
			Error        interface{}             `json:"error"`
		}

		err := client.Get(fmt.Sprintf("/api/eval/status/%s", runID), &statusResponse)
		if err != nil {
			spinner.Stop()
			handleAPIError(err)
			os.Exit(1)
		}

		DebugLog("Poll response: status=%s, results=%d", statusResponse.Status, len(statusResponse.Results))

		// Display header once when we get the data
		if !headerDisplayed && statusResponse.SuiteName != "" {
			spinner.Stop()
			fmt.Println()
			if statusResponse.IsUpdate {
				display.Warn("Updating eval suite: %s", statusResponse.SuiteName)
			} else {
				display.Success("Saving new eval suite: %s", statusResponse.SuiteName)
			}
			fmt.Println()
			display.Bold("Running evaluation: %s", statusResponse.SuiteName)
			display.Bold("Model: %s", statusResponse.Model)
			display.Bold("System prompt: %s", statusResponse.SystemPrompt)
			fmt.Println()
			headerDisplayed = true
			spinner.Start()
		}

		switch statusResponse.Status {
		case "running":
			if len(statusResponse.Results) > lastDisplayedCount {
				spinner.Stop()
				displayResults(statusResponse.Results[lastDisplayedCount:])
				lastDisplayedCount = len(statusResponse.Results)
				spinner.Start()
			}

		case "completed":
			spinner.Stop()
			if len(statusResponse.Results) > lastDisplayedCount {
				displayResults(statusResponse.Results[lastDisplayedCount:])
			}
			completed = true
			displaySummary(statusResponse.Results, statusResponse.TotalTimeMs)

		case "failed":
			spinner.Stop()
			errorMsg := getErrorMessage(statusResponse.Error)
			if errorMsg == "" {
				errorMsg = "All evaluations failed due to execution errors"
			}
			display.Error("\n%s", errorMsg)
			completed = true
			os.Exit(1)

		case "partial_failure":
			spinner.Stop()
			if len(statusResponse.Results) > lastDisplayedCount {
				displayResults(statusResponse.Results[lastDisplayedCount:])
			}
			completed = true
			display.Warn("\nWarning: Some evaluations failed to execute")
			errorMsg := getErrorMessage(statusResponse.Error)
			if errorMsg != "" {
				display.Warn("   %s", errorMsg)
			}
			displaySummary(statusResponse.Results, statusResponse.TotalTimeMs)
			os.Exit(1)

		case "timed_out":
			spinner.Stop()
			if len(statusResponse.Results) > lastDisplayedCount {
				displayResults(statusResponse.Results[lastDisplayedCount:])
			}
			completed = true
			display.Warn("\nEvaluation suite timed out")
			errorMsg := getErrorMessage(statusResponse.Error)
			if errorMsg != "" {
				display.Warn("   %s", errorMsg)
			}
			displaySummary(statusResponse.Results, statusResponse.TotalTimeMs)
			os.Exit(1)

		case "error":
			spinner.Stop()
			errorMsg := getErrorMessage(statusResponse.Error)
			if errorMsg == "" {
				errorMsg = "Vibe check failed"
			}
			display.Error("\n%s", errorMsg)
			completed = true
			os.Exit(1)
		}

		if !completed {
			time.Sleep(pollInterval)
		}
	}
}

func getErrorMessage(err interface{}) string {
	if err == nil {
		return ""
	}
	switch e := err.(type) {
	case string:
		return e
	case map[string]interface{}:
		if msg, ok := e["message"].(string); ok {
			return msg
		}
	}
	return fmt.Sprintf("%v", err)
}

func displayResults(results []schema.EvalResult) {
	for _, result := range results {
		promptDisplay := truncateText(result.Prompt, 100)
		display.Bold("\n%s:", promptDisplay)
		display.Info("Prompt: %s", result.Prompt)
		display.Gray("Response: %s", result.Response)

		for _, cond := range result.CheckResults {
			displayConditionalResult(cond, result.Response, 2)
		}

		fmt.Print("  Overall: ")
		fmt.Println(display.PassStatus(result.Passed))
	}
}

func displayConditionalResult(cond schema.ConditionalResult, response string, indent int) {
	indentStr := strings.Repeat(" ", indent)
	status := display.PassStatus(cond.Passed)
	details := formatConditionalDetails(cond)

	checkType := cond.Type
	if len(checkType) < 25 {
		checkType = checkType + strings.Repeat(" ", 25-len(checkType))
	}

	if cond.Type == "llm_judge" {
		fmt.Printf("%s%s %s\n", indentStr, status, cond.Type)
		if details != "" {
			display.Gray("%s    %s", indentStr, details)
		}
	} else {
		fmt.Printf("%s%s %s %s\n", indentStr, status, checkType, color.New(color.FgHiBlack).Sprint(details))
	}

	// Display child results
	for _, child := range cond.Children {
		displayConditionalResult(child, response, indent+2)
	}
}

func formatConditionalDetails(cond schema.ConditionalResult) string {
	if cond.Type == "llm_judge" {
		if cond.Passed {
			return "PASS"
		}
		return truncateText(cond.Message, 80)
	}
	return truncateText(cond.Message, 60)
}

func displaySummary(results []schema.EvalResult, totalTimeMs int64) {
	if len(results) == 0 {
		return
	}

	passed := 0
	totalChecks := 0
	passedChecks := 0
	var totalCost float64

	for _, r := range results {
		if r.Passed {
			passed++
		}
		totalCost += r.Cost
		for _, c := range r.CheckResults {
			totalChecks++
			if c.Passed {
				passedChecks++
			}
		}
	}

	successRate := float64(passed) / float64(len(results)) * 100

	fmt.Println()
	fmt.Println(strings.Repeat("─", 60))
	fmt.Println()

	// Summary line with checkmarks
	for i, r := range results {
		name := fmt.Sprintf("eval-%d", i+1)
		checkmarks := ""
		for _, c := range r.CheckResults {
			if c.Passed {
				checkmarks += "+"
			} else {
				checkmarks += "-"
			}
		}
		status := display.PassIcon(r.Passed)
		timeStr := ""
		if r.ExecutionTimeMs > 0 {
			timeStr = fmt.Sprintf(" in %.1fs", float64(r.ExecutionTimeMs)/1000)
		}
		fmt.Printf("%s  %s  %s%s\n", name, checkmarks, status, timeStr)
	}

	fmt.Println()
	display.Bold("Summary:")
	fmt.Printf("  Evals: %d/%d passed\n", passed, len(results))
	fmt.Printf("  Checks: %d/%d passed\n", passedChecks, totalChecks)
	fmt.Printf("  Success Rate: %s\n", display.FormatSuccessRate(successRate))
	if totalCost > 0 {
		fmt.Printf("  Total Cost: $%.4f\n", totalCost)
	}
	if totalTimeMs > 0 {
		fmt.Printf("  Total Time: %.1fs\n", float64(totalTimeMs)/1000)
	}
	fmt.Println()

	// Exit with code 1 if success rate < 50%
	if successRate < 50 {
		os.Exit(1)
	}
}

func truncateText(text string, maxLength int) string {
	if len(text) <= maxLength {
		return text
	}
	return text[:maxLength-3] + "..."
}

func displayLegacyFormatError() {
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
}
