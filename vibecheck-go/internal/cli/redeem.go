package cli

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/hev/vibecheck/internal/config"
	"github.com/hev/vibecheck/internal/display"
	"github.com/spf13/cobra"
)

var redeemCmd = &cobra.Command{
	Use:   "redeem [code]",
	Short: "Redeem an invite code to create an organization and receive an API key",
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var code string
		if len(args) > 0 {
			code = args[0]
		}
		runRedeem(code)
	},
}

func init() {
	rootCmd.AddCommand(redeemCmd)
}

type redeemResponse struct {
	APIKey string `json:"apiKey"`
	Org    struct {
		ID      string  `json:"id"`
		Slug    string  `json:"slug"`
		Name    string  `json:"name"`
		Credits float64 `json:"credits"`
	} `json:"org"`
	Error string `json:"error,omitempty"`
}

func runRedeem(code string) {
	code = strings.TrimSpace(code)

	// If no code provided, prompt for it
	if code == "" {
		printPreviewHeader()
		display.Gray("Tip: Press Enter with no code to cancel.")
		code = promptLine("Enter your invite code: ")
		code = strings.TrimSpace(code)
		if code == "" {
			display.Gray("No code entered. Exiting redeem.")
			os.Exit(0)
		}
	}

	spinner := display.NewSpinner("Redeeming invite code...")
	spinner.Start()

	// Make the API request
	apiURL := config.GetAPIURL()
	url := fmt.Sprintf("%s/api/invites/redeem", apiURL)

	DebugLog("Request URL: %s", url)

	requestBody, _ := json.Marshal(map[string]string{"code": code})
	DebugLog("Request body: %s", string(requestBody))

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("POST", url, bytes.NewReader(requestBody))
	if err != nil {
		spinner.Fail("Failed to create request")
		display.Error("%s", err)
		os.Exit(1)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		spinner.Fail("Failed to redeem invite code")
		display.Error("\nThe developer preview can no longer be reached")
		display.Gray("\nYour run logs are available at: ~/.vibecheck/runs")
		display.Gray("Go to https://vibescheck.io to find out what's next.")
		fmt.Println()
		os.Exit(2)
	}
	defer resp.Body.Close()

	DebugLog("Response status: %d", resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		spinner.Fail("Failed to read response")
		display.Error("%s", err)
		os.Exit(1)
	}

	DebugLog("Response data: %s", string(body))

	// Handle error status codes
	if resp.StatusCode >= 400 {
		spinner.Fail("Failed to redeem invite code")
		handleRedeemError(resp.StatusCode, body)
		os.Exit(1)
	}

	var result redeemResponse
	if err := json.Unmarshal(body, &result); err != nil {
		spinner.Fail("Failed to parse response")
		display.Error("%s", err)
		os.Exit(1)
	}

	if result.Error != "" {
		spinner.Fail("Failed to redeem invite code")
		display.Error("\n%s", result.Error)
		os.Exit(1)
	}

	// Check if .env exists and has content
	envContent := config.ReadEnvFile()
	if envContent != "" {
		spinner.Stop()
		fmt.Println()
		display.Warn("Welcome back! It looks like you have an existing configuration.")
		display.Gray("Found: %s", config.GetEnvFilePath())
		if !promptYesNo("Would you like to overwrite your existing VIBECHECK_API_KEY? [y/N] ") {
			// Show the fresh API key so the user can copy it elsewhere
			fmt.Println()
			display.Info("Organization: %s", result.Org.Name)
			display.Info("Credits: %.1f", result.Org.Credits)
			display.Info("API Key: %s", result.APIKey)
			fmt.Println()
			display.Gray("Your API Key is above. Save this API key as you won't be able to access it again.")
			os.Exit(0)
		}
	}

	// Save API key to config
	if err := config.SaveAPIKey(result.APIKey); err != nil {
		spinner.Fail("Failed to save API key")
		display.Error("%s", err)
		os.Exit(1)
	}

	// Save the API URL used for redemption
	if err := config.SaveAPIURL(apiURL); err != nil {
		// Non-fatal, just log in debug mode
		DebugLog("Failed to save API URL: %s", err)
	}

	spinner.Success("Successfully redeemed invite code!")
	fmt.Println()
	display.Info("Organization: %s", result.Org.Name)
	display.Info("Credits: %.1f", result.Org.Credits)
	display.Info("API Key: %s", result.APIKey)
	fmt.Println()
	display.Gray("API key saved to: %s", config.GetEnvFilePath())
	fmt.Println()
	display.Success("You can now run evaluations with this organization.")
	fmt.Println()
}

func handleRedeemError(statusCode int, body []byte) {
	var errResp struct {
		Error string `json:"error"`
	}
	json.Unmarshal(body, &errResp)
	errorMsg := errResp.Error

	switch statusCode {
	case 400:
		if strings.Contains(errorMsg, "expired") {
			display.Error("\nInvite code expired")
		} else if strings.Contains(errorMsg, "already been used") {
			display.Error("\nThis invite code has already been used")
		} else if errorMsg != "" {
			display.Error("\n%s", errorMsg)
		} else {
			display.Error("\nBad request")
		}
	case 404:
		display.Error("\nInvalid invite code")
	case 409:
		display.Error("\nOrganization with this code already exists")
	case 500:
		display.Error("\nFailed to redeem invite code")
		display.Gray("Server error: The VibeCheck API encountered an error")
	default:
		if errorMsg != "" {
			display.Error("\n%s", errorMsg)
		} else {
			display.Error("\nUnknown error (status %d)", statusCode)
		}
	}
}

func printPreviewHeader() {
	lines := []string{
		"Welcome to the developer preview — a vibe check awaits",
		"Join the developer preview — time for a vibe check",
		"Step into the developer preview — commence the vibe check",
		"Begin your developer preview journey — start your vibe check",
		"Enter the developer preview — initiate your vibe check",
	}
	rand.Seed(time.Now().UnixNano())
	pick := lines[rand.Intn(len(lines))]
	fmt.Println()
	display.Warn(pick)
	fmt.Println()
}

func promptLine(prompt string) string {
	fmt.Print(prompt)
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	return strings.TrimSpace(line)
}

func promptYesNo(prompt string) bool {
	answer := strings.ToLower(strings.TrimSpace(promptLine(prompt)))
	return answer == "y" || answer == "yes"
}
