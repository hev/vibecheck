package cli

import (
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/fatih/color"
	"github.com/hev/vibecheck/internal/api"
	"github.com/hev/vibecheck/internal/display"
	"github.com/spf13/cobra"
)

var (
	// Filter flags for get runs
	getLimit       int
	getOffset      int
	getMcp         bool
	getPrice       string
	getProvider    string
	getStatus      string
	getStatusIn    string
	getStatusNe    string
	getModel       string
	getModelLike   string
	getSuite       string
	getMinCost     float64
	getMaxCost     float64
	getMinSuccess  float64
	getMaxSuccess  float64
	getDateFrom    string
	getDateTo      string
	getCompFrom    string
	getCompTo      string
	getMinDuration float64
	getMaxDuration float64
	getSortBy      string
	getCsv         bool
	getWatch       bool
)

var getCmd = &cobra.Command{
	Use:   "get <resource> [identifier]",
	Short: "Get suites, runs, organization info, variables, or secrets",
	Long: `Get resources from vibecheck API.

Examples:
  $ vibe get org                    Get organization info
  $ vibe get credits                Get credit balance
  $ vibe get models                 List available models
  $ vibe get suites                 List saved suites
  $ vibe get suite <name>           Get a specific suite
  $ vibe get runs                   List recent runs
  $ vibe get run <id>               Get a specific run
  $ vibe get vars                   List variables
  $ vibe get var <name>             Get a specific variable
  $ vibe get secrets                List secret names`,
	Args: cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		noun := strings.ToLower(args[0])
		identifier := ""
		if len(args) > 1 {
			identifier = args[1]
		}

		switch noun {
		case "org", "organization", "credits":
			runGetOrg()
		case "models", "model":
			runGetModels()
		case "suites", "suite", "evals", "eval":
			if identifier != "" {
				runGetSuite(identifier)
			} else {
				runGetSuites()
			}
		case "runs", "run":
			if identifier != "" {
				runGetRun(identifier)
			} else {
				runGetRuns()
			}
		case "vars", "var":
			if identifier != "" {
				runGetVar(identifier)
			} else {
				runGetVars()
			}
		case "secret", "secrets":
			if identifier != "" {
				display.Error("Error: Secret values cannot be read")
				display.Gray("Secrets are write-only for security reasons. Use \"vibe get secrets\" to list secret names.")
				os.Exit(1)
			} else {
				runGetSecrets()
			}
		default:
			display.Error("Error: Unknown resource type \"%s\"", noun)
			display.Gray("Valid types: suites, suite, evals, eval, runs, run, org, credits, models, vars, var, secrets, secret")
			os.Exit(1)
		}
	},
}

func init() {
	getCmd.Flags().IntVarP(&getLimit, "limit", "l", 50, "Limit number of results")
	getCmd.Flags().IntVarP(&getOffset, "offset", "o", 0, "Offset for pagination")
	getCmd.Flags().BoolVar(&getMcp, "mcp", false, "Filter models to only show those with MCP support")
	getCmd.Flags().StringVar(&getPrice, "price", "", "Filter models by price quartile(s): 1,2,3,4")
	getCmd.Flags().StringVar(&getProvider, "provider", "", "Filter models by provider(s), comma-separated")

	// Runs filtering options
	getCmd.Flags().StringVarP(&getStatus, "status", "s", "", "Filter runs by status (exact match)")
	getCmd.Flags().StringVar(&getStatusIn, "status-in", "", "Filter runs by multiple statuses (comma-separated)")
	getCmd.Flags().StringVar(&getStatusNe, "status-ne", "", "Filter runs by status (not equal)")
	getCmd.Flags().StringVarP(&getModel, "model", "m", "", "Filter runs by model (exact match)")
	getCmd.Flags().StringVar(&getModelLike, "model-like", "", "Filter runs by model (pattern matching)")
	getCmd.Flags().StringVarP(&getSuite, "suite", "e", "", "Filter runs by suite name")
	getCmd.Flags().Float64Var(&getMinCost, "min-cost", 0, "Filter runs with minimum total cost")
	getCmd.Flags().Float64Var(&getMaxCost, "max-cost", 0, "Filter runs with maximum total cost")
	getCmd.Flags().Float64Var(&getMinSuccess, "min-success", 0, "Filter runs with minimum success percentage (0-100)")
	getCmd.Flags().Float64Var(&getMaxSuccess, "max-success", 0, "Filter runs with maximum success percentage (0-100)")
	getCmd.Flags().StringVar(&getDateFrom, "date-from", "", "Filter runs created on or after date (ISO format)")
	getCmd.Flags().StringVar(&getDateTo, "date-to", "", "Filter runs created on or before date (ISO format)")
	getCmd.Flags().StringVar(&getCompFrom, "completed-from", "", "Filter runs completed on or after date (ISO format)")
	getCmd.Flags().StringVar(&getCompTo, "completed-to", "", "Filter runs completed on or before date (ISO format)")
	getCmd.Flags().Float64Var(&getMinDuration, "min-duration", 0, "Filter runs with minimum duration in seconds")
	getCmd.Flags().Float64Var(&getMaxDuration, "max-duration", 0, "Filter runs with maximum duration in seconds")
	getCmd.Flags().StringVar(&getSortBy, "sort-by", "created", "Sort runs by field: created, success, cost, time, price-performance")
	getCmd.Flags().BoolVar(&getCsv, "csv", false, "Export runs to CSV file")
	getCmd.Flags().BoolVarP(&getWatch, "watch", "w", false, "Watch mode: continuously poll for updates")

	rootCmd.AddCommand(getCmd)
}

func runGetOrg() {
	client := api.NewClient(debug)

	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	spinner := display.NewSpinner("Fetching organization info...")
	spinner.Start()

	var orgInfo struct {
		Name      string  `json:"name"`
		Slug      string  `json:"slug"`
		Status    string  `json:"status"`
		Credits   float64 `json:"credits"`
		CreatedAt string  `json:"created_at"`
		Error     string  `json:"error,omitempty"`
	}

	err := client.Get("/api/orginfo", &orgInfo)
	if err != nil {
		spinner.Fail("Failed to fetch organization info")
		handleAPIError(err)
		os.Exit(1)
	}

	if orgInfo.Error != "" {
		spinner.Fail(fmt.Sprintf("Error: %s", orgInfo.Error))
		os.Exit(1)
	}

	spinner.Stop()

	fmt.Println()
	display.Bold("Organization Information:")
	fmt.Println()
	display.Info("Organization: %s", orgInfo.Name)
	display.Info("Slug: %s", orgInfo.Slug)
	display.Info("Status: %s", orgInfo.Status)

	// Color code credits
	creditsStr := fmt.Sprintf("$%.2f", orgInfo.Credits)
	if orgInfo.Credits < 1.00 {
		display.Print("Available Credits: ")
		color.New(color.FgRed).Print(creditsStr)
	} else {
		display.Print("Available Credits: ")
		fmt.Print(creditsStr)
	}
	display.Gray(" (Credit balance may be delayed.)")
	fmt.Println()

	if orgInfo.CreatedAt != "" {
		t, err := time.Parse(time.RFC3339, orgInfo.CreatedAt)
		if err == nil {
			display.Gray("Created: %s", t.Local().Format("Jan 2, 2006 3:04 PM"))
		}
	}
	fmt.Println()
}

func runGetModels() {
	client := api.NewClient(debug)

	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	spinner := display.NewSpinner("Fetching available models...")
	spinner.Start()

	var response struct {
		Models []ModelInfo `json:"models"`
		Error  string      `json:"error,omitempty"`
	}

	err := client.Get("/api/models", &response)
	if err != nil {
		spinner.Fail("Failed to fetch models")
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		spinner.Fail(fmt.Sprintf("Error: %s", response.Error))
		os.Exit(1)
	}

	spinner.Stop()

	models := response.Models
	if len(models) == 0 {
		display.Warn("No models available")
		return
	}

	// Calculate price tiers
	priceTiers := calculatePriceTiers(models)

	// Parse filters
	priceQuartiles := parsePriceQuartiles(getPrice)
	providers := parseProviders(getProvider)

	// Apply filters
	if getMcp {
		filtered := make([]ModelInfo, 0)
		for _, m := range models {
			if m.HasMcpSupport() {
				filtered = append(filtered, m)
			}
		}
		models = filtered
	}

	if len(priceQuartiles) > 0 {
		priceSymbols := make([]string, len(priceQuartiles))
		for i, q := range priceQuartiles {
			priceSymbols[i] = strings.Repeat("$", q)
		}
		filtered := make([]ModelInfo, 0)
		for _, m := range models {
			tier := priceTiers[m.ID]
			for _, ps := range priceSymbols {
				if tier == ps {
					filtered = append(filtered, m)
					break
				}
			}
		}
		models = filtered
	}

	if len(providers) > 0 {
		filtered := make([]ModelInfo, 0)
		for _, m := range models {
			parts := strings.Split(strings.ToLower(m.ID), "/")
			if len(parts) > 0 {
				for _, p := range providers {
					if parts[0] == p {
						filtered = append(filtered, m)
						break
					}
				}
			}
		}
		models = filtered
	}

	if len(models) == 0 {
		display.Warn("No models match the specified filters")
		return
	}

	// Build filter description
	filterDesc := ""
	if getMcp || len(priceQuartiles) > 0 || len(providers) > 0 {
		filters := []string{}
		if getMcp {
			filters = append(filters, "MCP only")
		}
		if len(priceQuartiles) > 0 {
			priceSymbols := make([]string, len(priceQuartiles))
			for i, q := range priceQuartiles {
				priceSymbols[i] = strings.Repeat("$", q)
			}
			filters = append(filters, "Price: "+strings.Join(priceSymbols, ", "))
		}
		if len(providers) > 0 {
			filters = append(filters, "Provider: "+strings.Join(providers, ", "))
		}
		filterDesc = " [" + strings.Join(filters, "] [") + "]"
	}

	// Display table
	fmt.Println()
	display.Bold("Models (%d)%s", len(models), filterDesc)
	fmt.Println()

	// Column widths
	w1, w2, w3, w4 := 40, 50, 5, 6

	// Header
	display.Bold("%s  %s  %s  %s", pad("ID", w1), pad("Description", w2), pad("MCP", w3), pad("Price", w4))
	fmt.Println(strings.Repeat("-", w1+w2+w3+w4+6))

	// Rows
	cyan := color.New(color.FgCyan)
	gray := color.New(color.FgHiBlack)
	green := color.New(color.FgGreen)

	for _, model := range models {
		id := model.ID
		desc := model.Description
		if desc == "" {
			desc = model.Name
		}
		mcp := "no"
		if model.HasMcpSupport() {
			mcp = "yes"
		}
		priceTier := priceTiers[model.ID]
		if priceTier == "" {
			priceTier = "-"
		}

		cyan.Print(pad(id, w1))
		fmt.Print("  ")
		gray.Print(pad(desc, w2))
		fmt.Print("  ")
		if mcp == "yes" {
			green.Print(pad(mcp, w3))
		} else {
			gray.Print(pad(mcp, w3))
		}
		fmt.Print("  ")
		fmt.Println(colorizePriceTier(priceTier))
	}
	fmt.Println()
}

func runGetSuites() {
	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	spinner := display.NewSpinner("Fetching suites...")
	spinner.Start()

	var response struct {
		Suites []struct {
			Name      string `json:"name"`
			CreatedAt string `json:"createdAt"`
			UpdatedAt string `json:"updatedAt"`
		} `json:"suites"`
		Error string `json:"error,omitempty"`
	}

	err := client.Get("/api/suite/list", &response)
	if err != nil {
		spinner.Fail("Failed to fetch suites")
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		spinner.Fail(fmt.Sprintf("Error: %s", response.Error))
		os.Exit(1)
	}

	spinner.Stop()

	if len(response.Suites) == 0 {
		display.Info("No suites found")
		display.Gray("Create one with: vibe set suite -f <file>")
		return
	}

	fmt.Println()
	display.Bold("Suites (%d)", len(response.Suites))
	fmt.Println()

	w1, w2, w3 := 30, 20, 20
	display.Bold("%s  %s  %s", pad("Name", w1), pad("Created", w2), pad("Updated", w3))
	fmt.Println(strings.Repeat("-", w1+w2+w3+4))

	cyan := color.New(color.FgCyan)
	gray := color.New(color.FgHiBlack)

	for _, suite := range response.Suites {
		created := formatTime(suite.CreatedAt)
		updated := formatTime(suite.UpdatedAt)
		cyan.Print(pad(suite.Name, w1))
		fmt.Print("  ")
		gray.Print(pad(created, w2))
		fmt.Print("  ")
		gray.Println(pad(updated, w3))
	}
	fmt.Println()
}

func runGetSuite(name string) {
	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	spinner := display.NewSpinner(fmt.Sprintf("Fetching suite \"%s\"...", name))
	spinner.Start()

	var response struct {
		Suite struct {
			Name        string `json:"name"`
			YamlContent string `json:"yamlContent"`
			CreatedAt   string `json:"createdAt"`
			UpdatedAt   string `json:"updatedAt"`
		} `json:"suite"`
		Error string `json:"error,omitempty"`
	}

	err := client.Get(fmt.Sprintf("/api/suite/%s", name), &response)
	if err != nil {
		spinner.Fail("Failed to fetch suite")
		if api.IsNotFoundError(err) {
			display.Error("\nSuite \"%s\" not found", name)
			display.Gray("Use \"vibe get suites\" to list available suites")
		} else {
			handleAPIError(err)
		}
		os.Exit(1)
	}

	if response.Error != "" {
		spinner.Fail(fmt.Sprintf("Error: %s", response.Error))
		os.Exit(1)
	}

	spinner.Stop()

	fmt.Println()
	display.Bold("Suite: %s", response.Suite.Name)
	display.Gray("Created: %s", formatTime(response.Suite.CreatedAt))
	display.Gray("Updated: %s", formatTime(response.Suite.UpdatedAt))
	fmt.Println()
	fmt.Println(response.Suite.YamlContent)
}

func runGetRuns() {
	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	spinner := display.NewSpinner("Fetching runs...")
	spinner.Start()

	// Build query params
	queryParams := []string{}
	if getLimit > 0 {
		queryParams = append(queryParams, fmt.Sprintf("limit=%d", getLimit))
	}
	if getOffset > 0 {
		queryParams = append(queryParams, fmt.Sprintf("offset=%d", getOffset))
	}
	if getStatus != "" {
		queryParams = append(queryParams, fmt.Sprintf("status=%s", getStatus))
	}
	if getStatusIn != "" {
		queryParams = append(queryParams, fmt.Sprintf("statusIn=%s", getStatusIn))
	}
	if getStatusNe != "" {
		queryParams = append(queryParams, fmt.Sprintf("statusNe=%s", getStatusNe))
	}
	if getModel != "" {
		queryParams = append(queryParams, fmt.Sprintf("model=%s", getModel))
	}
	if getModelLike != "" {
		queryParams = append(queryParams, fmt.Sprintf("modelLike=%s", getModelLike))
	}
	if getSuite != "" {
		queryParams = append(queryParams, fmt.Sprintf("suite=%s", getSuite))
	}
	if getMinCost > 0 {
		queryParams = append(queryParams, fmt.Sprintf("minCost=%.4f", getMinCost))
	}
	if getMaxCost > 0 {
		queryParams = append(queryParams, fmt.Sprintf("maxCost=%.4f", getMaxCost))
	}
	if getMinSuccess > 0 {
		queryParams = append(queryParams, fmt.Sprintf("minSuccess=%.2f", getMinSuccess))
	}
	if getMaxSuccess > 0 {
		queryParams = append(queryParams, fmt.Sprintf("maxSuccess=%.2f", getMaxSuccess))
	}
	if getDateFrom != "" {
		queryParams = append(queryParams, fmt.Sprintf("dateFrom=%s", getDateFrom))
	}
	if getDateTo != "" {
		queryParams = append(queryParams, fmt.Sprintf("dateTo=%s", getDateTo))
	}
	if getCompFrom != "" {
		queryParams = append(queryParams, fmt.Sprintf("completedFrom=%s", getCompFrom))
	}
	if getCompTo != "" {
		queryParams = append(queryParams, fmt.Sprintf("completedTo=%s", getCompTo))
	}
	if getMinDuration > 0 {
		queryParams = append(queryParams, fmt.Sprintf("minDuration=%.2f", getMinDuration))
	}
	if getMaxDuration > 0 {
		queryParams = append(queryParams, fmt.Sprintf("maxDuration=%.2f", getMaxDuration))
	}
	if getSortBy != "" && getSortBy != "created" {
		queryParams = append(queryParams, fmt.Sprintf("sortBy=%s", getSortBy))
	}

	endpoint := "/api/runs"
	if len(queryParams) > 0 {
		endpoint += "?" + strings.Join(queryParams, "&")
	}

	var response struct {
		Runs []struct {
			ID               string  `json:"id"`
			SuiteName        string  `json:"suiteName"`
			Model            string  `json:"model"`
			Status           string  `json:"status"`
			SuccessRate      float64 `json:"successRate"`
			TotalCost        float64 `json:"totalCost"`
			TotalTimeSeconds float64 `json:"totalTimeSeconds"`
			CreatedAt        string  `json:"createdAt"`
		} `json:"runs"`
		Total int    `json:"total"`
		Error string `json:"error,omitempty"`
	}

	err := client.Get(endpoint, &response)
	if err != nil {
		spinner.Fail("Failed to fetch runs")
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		spinner.Fail(fmt.Sprintf("Error: %s", response.Error))
		os.Exit(1)
	}

	spinner.Stop()

	if len(response.Runs) == 0 {
		display.Info("No runs found")
		return
	}

	fmt.Println()
	display.Bold("Runs (%d)", len(response.Runs))
	fmt.Println()

	w1, w2, w3, w4, w5, w6, w7 := 12, 20, 30, 10, 8, 8, 16
	display.Bold("%s  %s  %s  %s  %s  %s  %s",
		pad("ID", w1), pad("Suite", w2), pad("Model", w3), pad("Status", w4),
		pad("Success", w5), pad("Cost", w6), pad("Created", w7))
	fmt.Println(strings.Repeat("-", w1+w2+w3+w4+w5+w6+w7+12))

	gray := color.New(color.FgHiBlack)

	for _, run := range response.Runs {
		idShort := run.ID
		if len(idShort) > 12 {
			idShort = idShort[:12]
		}

		statusColor := color.New(color.FgWhite)
		switch run.Status {
		case "completed":
			statusColor = color.New(color.FgGreen)
		case "running":
			statusColor = color.New(color.FgCyan)
		case "failed":
			statusColor = color.New(color.FgRed)
		case "queued":
			statusColor = color.New(color.FgYellow)
		}

		successStr := fmt.Sprintf("%.0f%%", run.SuccessRate*100)
		costStr := fmt.Sprintf("$%.4f", run.TotalCost)

		gray.Print(pad(idShort, w1))
		fmt.Print("  ")
		fmt.Print(pad(run.SuiteName, w2))
		fmt.Print("  ")
		gray.Print(pad(run.Model, w3))
		fmt.Print("  ")
		statusColor.Print(pad(run.Status, w4))
		fmt.Print("  ")
		fmt.Print(pad(successStr, w5))
		fmt.Print("  ")
		fmt.Print(pad(costStr, w6))
		fmt.Print("  ")
		gray.Println(formatTime(run.CreatedAt))
	}
	fmt.Println()
}

func runGetRun(id string) {
	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	spinner := display.NewSpinner(fmt.Sprintf("Fetching run %s...", id))
	spinner.Start()

	var response struct {
		Run struct {
			ID               string  `json:"id"`
			SuiteName        string  `json:"suiteName"`
			Model            string  `json:"model"`
			Status           string  `json:"status"`
			SuccessRate      float64 `json:"successRate"`
			TotalCost        float64 `json:"totalCost"`
			TotalTimeSeconds float64 `json:"totalTimeSeconds"`
			CreatedAt        string  `json:"createdAt"`
			CompletedAt      string  `json:"completedAt"`
			Results          []struct {
				EvalName     string `json:"evalName"`
				Prompt       string `json:"prompt"`
				Response     string `json:"response"`
				Passed       bool   `json:"passed"`
				CheckResults []struct {
					Type    string `json:"type"`
					Passed  bool   `json:"passed"`
					Message string `json:"message"`
				} `json:"checkResults"`
			} `json:"results"`
		} `json:"run"`
		Error string `json:"error,omitempty"`
	}

	err := client.Get(fmt.Sprintf("/api/runs/%s", id), &response)
	if err != nil {
		spinner.Fail("Failed to fetch run")
		if api.IsNotFoundError(err) {
			display.Error("\nRun not found: %s", id)
		} else {
			handleAPIError(err)
		}
		os.Exit(1)
	}

	if response.Error != "" {
		spinner.Fail(fmt.Sprintf("Error: %s", response.Error))
		os.Exit(1)
	}

	spinner.Stop()

	run := response.Run

	fmt.Println()
	display.Bold("Run: %s", run.ID)
	fmt.Println()
	display.Info("Suite: %s", run.SuiteName)
	display.Info("Model: %s", run.Model)
	display.Info("Status: %s", run.Status)
	display.Info("Success Rate: %.0f%%", run.SuccessRate*100)
	display.Info("Total Cost: $%.4f", run.TotalCost)
	display.Info("Total Time: %.1fs", run.TotalTimeSeconds)
	display.Gray("Created: %s", formatTime(run.CreatedAt))
	if run.CompletedAt != "" {
		display.Gray("Completed: %s", formatTime(run.CompletedAt))
	}

	if len(run.Results) > 0 {
		fmt.Println()
		display.Bold("Results:")
		for i, result := range run.Results {
			fmt.Println()
			display.Info("Eval %d: %s", i+1, truncateForDisplay(result.Prompt, 60))
			display.Gray("Response: %s", truncateForDisplay(result.Response, 100))
			fmt.Printf("  Status: %s\n", display.PassStatus(result.Passed))
			for _, check := range result.CheckResults {
				checkStatus := display.PassIcon(check.Passed)
				fmt.Printf("    %s %s: %s\n", checkStatus, check.Type, truncateForDisplay(check.Message, 50))
			}
		}
	}
	fmt.Println()
}

func formatTime(isoTime string) string {
	if isoTime == "" {
		return "-"
	}
	t, err := time.Parse(time.RFC3339, isoTime)
	if err != nil {
		return isoTime
	}
	return t.Local().Format("Jan 2, 15:04")
}

func truncateForDisplay(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func runGetVars() {
	runGetVarsImpl()
}

func runGetVar(name string) {
	runGetVarImpl(name)
}

func runGetSecrets() {
	runGetSecretsImpl()
}

// Helper types and functions

type ModelInfo struct {
	ID                  string            `json:"id"`
	Name                string            `json:"name,omitempty"`
	Description         string            `json:"description,omitempty"`
	SupportedParameters []string          `json:"supported_parameters,omitempty"`
	Pricing             *ModelPricing     `json:"pricing,omitempty"`
}

type ModelPricing struct {
	Prompt     string `json:"prompt"`
	Completion string `json:"completion"`
	Request    string `json:"request,omitempty"`
	Image      string `json:"image,omitempty"`
}

func (m *ModelInfo) HasMcpSupport() bool {
	for _, p := range m.SupportedParameters {
		if p == "tools" {
			return true
		}
	}
	return false
}

func calculatePriceTiers(models []ModelInfo) map[string]string {
	type modelPrice struct {
		id       string
		avgPrice float64
	}

	prices := make([]modelPrice, 0)
	for _, m := range models {
		if m.Pricing != nil && m.Pricing.Prompt != "" && m.Pricing.Completion != "" {
			prompt, err1 := strconv.ParseFloat(m.Pricing.Prompt, 64)
			completion, err2 := strconv.ParseFloat(m.Pricing.Completion, 64)
			if err1 == nil && err2 == nil {
				prices = append(prices, modelPrice{
					id:       m.ID,
					avgPrice: (prompt + completion) / 2,
				})
			}
		}
	}

	sort.Slice(prices, func(i, j int) bool {
		return prices[i].avgPrice < prices[j].avgPrice
	})

	tiers := make(map[string]string)
	quartileSize := (len(prices) + 3) / 4 // Ceiling division

	for i, mp := range prices {
		if i < quartileSize {
			tiers[mp.id] = "$"
		} else if i < quartileSize*2 {
			tiers[mp.id] = "$$"
		} else if i < quartileSize*3 {
			tiers[mp.id] = "$$$"
		} else {
			tiers[mp.id] = "$$$$"
		}
	}

	return tiers
}

func parsePriceQuartiles(filter string) []int {
	if filter == "" {
		return nil
	}
	parts := strings.Split(filter, ",")
	result := make([]int, 0)
	for _, p := range parts {
		q, err := strconv.Atoi(strings.TrimSpace(p))
		if err == nil && q >= 1 && q <= 4 {
			result = append(result, q)
		}
	}
	return result
}

func parseProviders(filter string) []string {
	if filter == "" {
		return nil
	}
	parts := strings.Split(filter, ",")
	result := make([]string, 0)
	for _, p := range parts {
		trimmed := strings.TrimSpace(strings.ToLower(p))
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func pad(s string, width int) string {
	if len(s) > width {
		return s[:width-1] + "…"
	}
	return s + strings.Repeat(" ", width-len(s))
}

func colorizePriceTier(tier string) string {
	switch tier {
	case "$":
		return color.New(color.FgGreen).Sprint(tier)
	case "$$":
		return color.New(color.FgYellow).Sprint(tier)
	case "$$$":
		return color.New(color.FgHiRed).Sprint(tier) // Orange-ish
	case "$$$$":
		return color.New(color.FgRed).Sprint(tier)
	default:
		return color.New(color.FgHiBlack).Sprint("-")
	}
}

func displayAuthError() {
	display.Error("Error: API key required")
	display.Gray("Get your API key at vibescheck.io and set it:")
	display.Gray("  1. Set VIBECHECK_API_KEY environment variable, or")
	display.Gray("  2. Run 'vibe redeem' to enter an invite code")
}

func handleAPIError(err error) {
	if api.IsAuthError(err) {
		displayAuthError()
	} else if api.IsPaymentError(err) {
		display.Error("Payment required: Your credits are running low")
		display.Gray("Visit https://vibescheck.io to add credits")
	} else {
		display.Error("%s", err)
	}
}
