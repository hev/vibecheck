package config

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const (
	DefaultAPIURL = "https://vibecheck-api-prod-681369865361.us-central1.run.app"
	ConfigDirName = ".vibecheck"
	EnvFileName   = ".env"
)

var (
	apiKeyRegex = regexp.MustCompile(`^VIBECHECK_API_KEY=(.+)$`)
	apiURLRegex = regexp.MustCompile(`^VIBECHECK_URL=(.+)$`)
)

// GetConfigDir returns the path to the config directory (~/.vibecheck)
func GetConfigDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ConfigDirName)
}

// GetEnvFilePath returns the path to the .env file
func GetEnvFilePath() string {
	return filepath.Join(GetConfigDir(), EnvFileName)
}

// EnsureConfigDir creates the config directory if it doesn't exist
func EnsureConfigDir() error {
	dir := GetConfigDir()
	if dir == "" {
		return nil
	}
	return os.MkdirAll(dir, 0755)
}

// ReadEnvFile reads the contents of the .env file
func ReadEnvFile() string {
	if err := EnsureConfigDir(); err != nil {
		return ""
	}

	path := GetEnvFilePath()
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return string(data)
}

// readEnvValue reads a specific value from the .env file using a regex
func readEnvValue(regex *regexp.Regexp) string {
	content := ReadEnvFile()
	if content == "" {
		return ""
	}

	scanner := bufio.NewScanner(strings.NewReader(content))
	for scanner.Scan() {
		line := scanner.Text()
		if matches := regex.FindStringSubmatch(line); len(matches) > 1 {
			return matches[1]
		}
	}
	return ""
}

// ReadAPIKey reads the API key from the .env file
func ReadAPIKey() string {
	return readEnvValue(apiKeyRegex)
}

// ReadAPIURL reads the API URL from the .env file
func ReadAPIURL() string {
	return readEnvValue(apiURLRegex)
}

// GetAPIURL returns the effective API URL with precedence:
// 1. Environment variable VIBECHECK_API_URL
// 2. Environment variable VIBECHECK_URL
// 3. Environment variable API_BASE_URL
// 4. .env file VIBECHECK_URL
// 5. Default production URL
func GetAPIURL() string {
	if url := os.Getenv("VIBECHECK_API_URL"); url != "" {
		return url
	}
	if url := os.Getenv("VIBECHECK_URL"); url != "" {
		return url
	}
	if url := os.Getenv("API_BASE_URL"); url != "" {
		return url
	}
	if url := ReadAPIURL(); url != "" {
		return url
	}
	return DefaultAPIURL
}

// GetAPIKey returns the effective API key with precedence:
// 1. Environment variable VIBECHECK_API_KEY
// 2. Environment variable API_KEY
// 3. .env file VIBECHECK_API_KEY
func GetAPIKey() string {
	if key := os.Getenv("VIBECHECK_API_KEY"); key != "" {
		return key
	}
	if key := os.Getenv("API_KEY"); key != "" {
		return key
	}
	return ReadAPIKey()
}

// SaveAPIKey writes or updates the API key in the .env file
func SaveAPIKey(apiKey string) error {
	return saveEnvValue("VIBECHECK_API_KEY", apiKey, apiKeyRegex)
}

// SaveAPIURL writes or updates the API URL in the .env file
func SaveAPIURL(url string) error {
	return saveEnvValue("VIBECHECK_URL", url, apiURLRegex)
}

// saveEnvValue writes or updates a value in the .env file
func saveEnvValue(key, value string, regex *regexp.Regexp) error {
	if err := EnsureConfigDir(); err != nil {
		return err
	}

	content := ReadEnvFile()
	newLine := key + "=" + value

	if regex.MatchString(content) {
		// Update existing value
		content = regex.ReplaceAllString(content, newLine)
	} else {
		// Add new value
		if content != "" && !strings.HasSuffix(content, "\n") {
			content += "\n"
		}
		content += newLine + "\n"
	}

	return os.WriteFile(GetEnvFilePath(), []byte(content), 0600)
}
