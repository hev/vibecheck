package cli

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/hev/vibecheck/internal/api"
	"github.com/hev/vibecheck/internal/display"
	"github.com/hev/vibecheck/internal/schema"
	"github.com/spf13/cobra"
)

var (
	setFile string
)

var setCmd = &cobra.Command{
	Use:   "set <resource> [args...]",
	Short: "Create or update resources (suites, variables, secrets)",
	Long: `Create or update resources.

Examples:
  $ vibe set suite -f eval.yaml     Save a suite from YAML file
  $ vibe set var MY_VAR "value"     Set a variable
  $ vibe set secret API_KEY "key"   Set a secret`,
	Args: cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		noun := strings.ToLower(args[0])

		switch noun {
		case "suite":
			runSetSuite()
		case "var":
			if len(args) < 3 {
				display.Error("Error: Variable name and value are required")
				display.Gray("Usage: vibe set var <name> <value>")
				os.Exit(1)
			}
			name := args[1]
			value := strings.Join(args[2:], " ")
			runSetVar(name, value)
		case "secret":
			if len(args) < 3 {
				display.Error("Error: Secret name and value are required")
				display.Gray("Usage: vibe set secret <name> <value>")
				os.Exit(1)
			}
			name := args[1]
			value := strings.Join(args[2:], " ")
			runSetSecret(name, value)
		default:
			display.Error("Error: Unknown resource type \"%s\"", noun)
			display.Gray("Valid types: suite, var, secret")
			os.Exit(1)
		}
	},
}

func init() {
	setCmd.Flags().StringVarP(&setFile, "file", "f", "", "Path to the YAML file (required for suite)")
	rootCmd.AddCommand(setCmd)
}

func runSetSuite() {
	if setFile == "" {
		display.Error("Error: --file option is required for \"vibe set suite\"")
		display.Gray("Usage: vibe set suite -f <file>")
		os.Exit(1)
	}

	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	spinner := display.NewSpinner("Loading suite...")
	spinner.Start()

	// Load and validate the suite
	suite, err := schema.LoadSuiteFromFile(setFile)
	if err != nil {
		spinner.Fail(fmt.Sprintf("Failed to load suite: %s", err))
		os.Exit(1)
	}

	// Read raw YAML content
	yamlContent, err := os.ReadFile(setFile)
	if err != nil {
		spinner.Fail(fmt.Sprintf("Failed to read file: %s", err))
		os.Exit(1)
	}

	spinner.UpdateMessage("Saving suite...")

	// POST to API
	requestBody := map[string]interface{}{
		"name":        suite.Metadata.Name,
		"yamlContent": string(yamlContent),
	}

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message,omitempty"`
		Error   string `json:"error,omitempty"`
	}

	err = client.Post("/api/suite/save", requestBody, &response)
	if err != nil {
		spinner.Fail("Failed to save suite")
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		spinner.Fail(fmt.Sprintf("Error: %s", response.Error))
		os.Exit(1)
	}

	spinner.Success(fmt.Sprintf("Suite \"%s\" saved successfully", suite.Metadata.Name))
}

func runSetVar(name, value string) {
	name = strings.TrimSpace(name)
	if name == "" {
		display.Error("Error: Variable name is required")
		os.Exit(1)
	}

	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	DebugLog("POST /api/runtime/vars")
	DebugLog("Body: {name: %s, value: %s}", name, value)

	requestBody := map[string]string{
		"name":  name,
		"value": value,
	}

	var response struct {
		Success bool   `json:"success"`
		Error   string `json:"error,omitempty"`
	}

	err := client.Post("/api/runtime/vars", requestBody, &response)
	if err != nil {
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		display.Error("Error: %s", response.Error)
		os.Exit(1)
	}

	display.Success("Var set.")
}

func runSetSecret(name, value string) {
	name = strings.TrimSpace(name)
	if name == "" {
		display.Error("Error: Secret name is required")
		os.Exit(1)
	}

	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	DebugLog("POST /api/runtime/secrets")
	DebugLog("Body: {name: %s, value: [REDACTED]}", name)

	requestBody := map[string]string{
		"name":  name,
		"value": value,
	}

	var response struct {
		Success bool   `json:"success"`
		Error   string `json:"error,omitempty"`
	}

	err := client.Post("/api/runtime/secrets", requestBody, &response)
	if err != nil {
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		display.Error("Error: %s", response.Error)
		os.Exit(1)
	}

	display.Success("Secret set.")
}

// Implementation for get commands that need var/secret access

func runGetVarsImpl() {
	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	DebugLog("GET /api/runtime/vars")

	var response struct {
		Vars  []struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		} `json:"vars"`
		Error string `json:"error,omitempty"`
	}

	err := client.Get("/api/runtime/vars", &response)
	if err != nil {
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		display.Error("Error: %s", response.Error)
		os.Exit(1)
	}

	for _, v := range response.Vars {
		fmt.Printf("%s=%s\n", v.Name, v.Value)
	}
}

func runGetVarImpl(name string) {
	name = strings.TrimSpace(name)
	if name == "" {
		display.Error("Error: Variable name is required")
		os.Exit(1)
	}

	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	DebugLog("GET /api/runtime/vars/%s", name)

	var response struct {
		Value string `json:"value"`
		Error string `json:"error,omitempty"`
	}

	err := client.Get(fmt.Sprintf("/api/runtime/vars/%s", url.PathEscape(name)), &response)
	if err != nil {
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		display.Error("Error: %s", response.Error)
		os.Exit(1)
	}

	fmt.Println(response.Value)
}

func runGetSecretsImpl() {
	client := api.NewClient(debug)
	if !client.HasAPIKey() {
		displayAuthError()
		os.Exit(1)
	}

	DebugLog("GET /api/runtime/secrets")

	var response struct {
		Secrets []struct {
			Name string `json:"name"`
		} `json:"secrets"`
		Error string `json:"error,omitempty"`
	}

	err := client.Get("/api/runtime/secrets", &response)
	if err != nil {
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		display.Error("Error: %s", response.Error)
		os.Exit(1)
	}

	for _, s := range response.Secrets {
		fmt.Println(s.Name)
	}
}
