package cli

import (
	"fmt"
	"os"
	"strings"

	"github.com/hev/vibecheck/internal/api"
	"github.com/hev/vibecheck/internal/display"
	"github.com/spf13/cobra"
)

var (
	stopModel     string
	stopModelLike string
	stopSuite     string
)

var stopCmd = &cobra.Command{
	Use:   "stop <run-id|queued>",
	Short: "Stop/cancel a queued run or all queued runs",
	Long: `Stop/cancel a queued run or all queued runs.

Examples:
  $ vibe stop abc123            Stop a specific run by ID
  $ vibe stop queued            Stop all queued runs
  $ vibe stop queued -m claude  Stop queued runs matching model`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		target := args[0]

		if target == "queued" {
			runStopQueued()
		} else {
			runStopRun(target)
		}
	},
}

func init() {
	stopCmd.Flags().StringVarP(&stopModel, "model", "m", "", "Filter queued runs by model (exact match)")
	stopCmd.Flags().StringVar(&stopModelLike, "model-like", "", "Filter queued runs by model (pattern matching)")
	stopCmd.Flags().StringVarP(&stopSuite, "suite", "e", "", "Filter queued runs by suite name")

	rootCmd.AddCommand(stopCmd)
}

func runStopRun(runID string) {
	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	spinner := display.NewSpinner(fmt.Sprintf("Cancelling run %s...", runID))
	spinner.Start()

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message,omitempty"`
		Error   string `json:"error,omitempty"`
	}

	err := client.Post(fmt.Sprintf("/api/runs/%s/cancel", runID), nil, &response)
	if err != nil {
		spinner.Fail("Failed to cancel run")
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		spinner.Fail(fmt.Sprintf("Error: %s", response.Error))
		os.Exit(1)
	}

	if response.Message != "" {
		spinner.Success(response.Message)
	} else {
		spinner.Success(fmt.Sprintf("Run %s cancelled", runID))
	}
}

func runStopQueued() {
	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	spinner := display.NewSpinner("Fetching queued runs...")
	spinner.Start()

	// Build query params
	queryParams := []string{"status=queued"}
	if stopModel != "" {
		queryParams = append(queryParams, fmt.Sprintf("model=%s", stopModel))
	}
	if stopModelLike != "" {
		queryParams = append(queryParams, fmt.Sprintf("modelLike=%s", stopModelLike))
	}
	if stopSuite != "" {
		queryParams = append(queryParams, fmt.Sprintf("suite=%s", stopSuite))
	}

	endpoint := "/api/runs?" + strings.Join(queryParams, "&")

	var listResponse struct {
		Runs []struct {
			ID string `json:"id"`
		} `json:"runs"`
		Error string `json:"error,omitempty"`
	}

	err := client.Get(endpoint, &listResponse)
	if err != nil {
		spinner.Fail("Failed to fetch queued runs")
		handleAPIError(err)
		os.Exit(1)
	}

	if listResponse.Error != "" {
		spinner.Fail(fmt.Sprintf("Error: %s", listResponse.Error))
		os.Exit(1)
	}

	if len(listResponse.Runs) == 0 {
		spinner.Stop()
		display.Info("No queued runs found matching the criteria")
		return
	}

	spinner.UpdateMessage(fmt.Sprintf("Cancelling %d queued runs...", len(listResponse.Runs)))

	cancelled := 0
	failed := 0

	for _, run := range listResponse.Runs {
		var response struct {
			Success bool   `json:"success"`
			Error   string `json:"error,omitempty"`
		}

		err := client.Post(fmt.Sprintf("/api/runs/%s/cancel", run.ID), nil, &response)
		if err != nil || response.Error != "" {
			failed++
			DebugLog("Failed to cancel run %s: %v", run.ID, err)
		} else {
			cancelled++
		}
	}

	spinner.Stop()

	if cancelled > 0 {
		display.Success("Cancelled %d queued runs", cancelled)
	}
	if failed > 0 {
		display.Warn("Failed to cancel %d runs", failed)
	}
}
