package cli

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/hev/vibecheck/internal/api"
	"github.com/hev/vibecheck/internal/display"
	"github.com/spf13/cobra"
)

var deleteCmd = &cobra.Command{
	Use:   "delete <resource> <name>",
	Short: "Delete resources (variables, secrets)",
	Long: `Delete resources.

Examples:
  $ vibe delete var MY_VAR         Delete a variable
  $ vibe delete secret API_KEY     Delete a secret`,
	Args: cobra.MinimumNArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		noun := strings.ToLower(args[0])
		name := args[1]

		switch noun {
		case "var":
			runDeleteVar(name)
		case "secret":
			runDeleteSecret(name)
		default:
			display.Error("Error: Unknown resource type \"%s\"", noun)
			display.Gray("Valid types: var, secret")
			os.Exit(1)
		}
	},
}

func init() {
	rootCmd.AddCommand(deleteCmd)
}

func runDeleteVar(name string) {
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

	DebugLog("DELETE /api/runtime/vars/%s", name)

	var response struct {
		Success bool   `json:"success"`
		Error   string `json:"error,omitempty"`
	}

	err := client.Delete(fmt.Sprintf("/api/runtime/vars/%s", url.PathEscape(name)), &response)
	if err != nil {
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		display.Error("Error: %s", response.Error)
		os.Exit(1)
	}

	display.Success("Var deleted.")
}

func runDeleteSecret(name string) {
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

	DebugLog("DELETE /api/runtime/secrets/%s", name)

	var response struct {
		Success bool   `json:"success"`
		Error   string `json:"error,omitempty"`
	}

	err := client.Delete(fmt.Sprintf("/api/runtime/secrets/%s", url.PathEscape(name)), &response)
	if err != nil {
		handleAPIError(err)
		os.Exit(1)
	}

	if response.Error != "" {
		display.Error("Error: %s", response.Error)
		os.Exit(1)
	}

	display.Success("Secret deleted.")
}
