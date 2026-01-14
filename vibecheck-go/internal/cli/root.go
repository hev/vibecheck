package cli

import (
	"fmt"
	"net/http"
	"time"

	"github.com/fatih/color"
	"github.com/hev/vibecheck/internal/config"
	"github.com/spf13/cobra"
)

const CLIVersion = "0.2.0"

var (
	debug bool
)

var rootCmd = &cobra.Command{
	Use:   "vibe",
	Short: "CLI tool for running language model evaluations",
	Long:  `vibe is a CLI tool for running language model evaluations against the vibecheck API.`,
	Run: func(cmd *cobra.Command, args []string) {
		cmd.Help()
	},
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Display version information",
	Run: func(cmd *cobra.Command, args []string) {
		displayVersion()
	},
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&debug, "debug", "d", false, "Enable debug logging")
	rootCmd.PersistentFlags().MarkHidden("debug")

	rootCmd.AddCommand(versionCmd)
}

func Execute() error {
	return rootCmd.Execute()
}

func displayVersion() {
	cyan := color.New(color.FgCyan)
	gray := color.New(color.FgHiBlack)
	green := color.New(color.FgGreen)
	red := color.New(color.FgRed)

	cyan.Printf("vibe CLI v%s\n", CLIVersion)

	apiURL := config.GetAPIURL()
	gray.Printf("Connected to: %s\n", apiURL)

	serverVersion := getServerVersion(apiURL)
	if serverVersion != "" {
		green.Printf("Server version: %s\n", serverVersion)
	} else {
		red.Println("Server: unreachable")
	}
}

func getServerVersion(apiURL string) string {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(fmt.Sprintf("%s/api/version", apiURL))
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ""
	}

	// Simple JSON parsing for version field
	var result struct {
		Version string `json:"version"`
	}
	if err := decodeJSON(resp.Body, &result); err != nil {
		return ""
	}
	return result.Version
}

// IsDebug returns the current debug flag state
func IsDebug() bool {
	return debug
}

// DebugLog prints debug output if debug mode is enabled
func DebugLog(format string, args ...interface{}) {
	if debug {
		cyan := color.New(color.FgCyan)
		cyan.Printf("[DEBUG] "+format+"\n", args...)
	}
}
