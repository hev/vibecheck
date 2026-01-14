package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetConfigDir(t *testing.T) {
	dir := GetConfigDir()
	if dir == "" {
		t.Skip("could not determine home directory")
	}
	if !filepath.IsAbs(dir) {
		t.Error("expected absolute path")
	}
	if filepath.Base(dir) != ConfigDirName {
		t.Errorf("expected dir to end with %s, got %s", ConfigDirName, filepath.Base(dir))
	}
}

func TestGetEnvFilePath(t *testing.T) {
	path := GetEnvFilePath()
	if path == "" {
		t.Skip("could not determine home directory")
	}
	if filepath.Base(path) != EnvFileName {
		t.Errorf("expected file to be %s, got %s", EnvFileName, filepath.Base(path))
	}
}

func TestGetAPIURL_Default(t *testing.T) {
	// Clear env vars
	os.Unsetenv("VIBECHECK_API_URL")
	os.Unsetenv("VIBECHECK_URL")
	os.Unsetenv("API_BASE_URL")

	// Use a temp home directory to avoid reading real .env
	origHome := os.Getenv("HOME")
	tmpDir := t.TempDir()
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	url := GetAPIURL()
	if url != DefaultAPIURL {
		t.Errorf("expected default URL %s, got %s", DefaultAPIURL, url)
	}
}

func TestGetAPIURL_EnvVarPrecedence(t *testing.T) {
	// Test VIBECHECK_API_URL takes precedence
	os.Setenv("VIBECHECK_API_URL", "https://custom-api.example.com")
	os.Setenv("VIBECHECK_URL", "https://other.example.com")
	defer func() {
		os.Unsetenv("VIBECHECK_API_URL")
		os.Unsetenv("VIBECHECK_URL")
	}()

	url := GetAPIURL()
	if url != "https://custom-api.example.com" {
		t.Errorf("expected VIBECHECK_API_URL to take precedence, got %s", url)
	}

	// Test VIBECHECK_URL when VIBECHECK_API_URL is unset
	os.Unsetenv("VIBECHECK_API_URL")
	url = GetAPIURL()
	if url != "https://other.example.com" {
		t.Errorf("expected VIBECHECK_URL to be used, got %s", url)
	}
}

func TestGetAPIKey_EnvVarPrecedence(t *testing.T) {
	os.Setenv("VIBECHECK_API_KEY", "env-key")
	os.Setenv("API_KEY", "fallback-key")
	defer func() {
		os.Unsetenv("VIBECHECK_API_KEY")
		os.Unsetenv("API_KEY")
	}()

	key := GetAPIKey()
	if key != "env-key" {
		t.Errorf("expected VIBECHECK_API_KEY to take precedence, got %s", key)
	}

	// Test API_KEY fallback
	os.Unsetenv("VIBECHECK_API_KEY")
	key = GetAPIKey()
	if key != "fallback-key" {
		t.Errorf("expected API_KEY fallback, got %s", key)
	}
}

func TestSaveAndReadAPIKey(t *testing.T) {
	// Use temp directory as HOME
	tmpDir := t.TempDir()
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	// Clear env vars to test file reading
	os.Unsetenv("VIBECHECK_API_KEY")
	os.Unsetenv("API_KEY")

	// Save API key
	testKey := "test-api-key-12345"
	err := SaveAPIKey(testKey)
	if err != nil {
		t.Fatalf("failed to save API key: %v", err)
	}

	// Read it back
	key := ReadAPIKey()
	if key != testKey {
		t.Errorf("expected key '%s', got '%s'", testKey, key)
	}

	// Verify GetAPIKey also works
	key = GetAPIKey()
	if key != testKey {
		t.Errorf("GetAPIKey expected '%s', got '%s'", testKey, key)
	}
}

func TestSaveAndReadAPIURL(t *testing.T) {
	// Use temp directory as HOME
	tmpDir := t.TempDir()
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	// Clear env vars
	os.Unsetenv("VIBECHECK_API_URL")
	os.Unsetenv("VIBECHECK_URL")
	os.Unsetenv("API_BASE_URL")

	// Save API URL
	testURL := "https://custom.example.com"
	err := SaveAPIURL(testURL)
	if err != nil {
		t.Fatalf("failed to save API URL: %v", err)
	}

	// Read it back
	url := ReadAPIURL()
	if url != testURL {
		t.Errorf("expected URL '%s', got '%s'", testURL, url)
	}
}

func TestSaveAPIKey_UpdatesExisting(t *testing.T) {
	// Use temp directory as HOME
	tmpDir := t.TempDir()
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	os.Unsetenv("VIBECHECK_API_KEY")
	os.Unsetenv("API_KEY")

	// Save initial key
	err := SaveAPIKey("initial-key")
	if err != nil {
		t.Fatalf("failed to save initial key: %v", err)
	}

	// Update key
	err = SaveAPIKey("updated-key")
	if err != nil {
		t.Fatalf("failed to update key: %v", err)
	}

	// Verify the update
	key := ReadAPIKey()
	if key != "updated-key" {
		t.Errorf("expected 'updated-key', got '%s'", key)
	}

	// Verify file only has one entry
	content := ReadEnvFile()
	count := 0
	for _, line := range []byte(content) {
		if line == '\n' {
			count++
		}
	}
	// Should have approximately 1 newline (one line of content)
	if count > 2 {
		t.Errorf("expected 1-2 lines, file content: %s", content)
	}
}

func TestEnsureConfigDir(t *testing.T) {
	// Use temp directory as HOME
	tmpDir := t.TempDir()
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	err := EnsureConfigDir()
	if err != nil {
		t.Fatalf("failed to ensure config dir: %v", err)
	}

	configDir := GetConfigDir()
	info, err := os.Stat(configDir)
	if err != nil {
		t.Fatalf("config dir does not exist: %v", err)
	}
	if !info.IsDir() {
		t.Error("expected config dir to be a directory")
	}
}

func TestReadEnvFile_Empty(t *testing.T) {
	// Use temp directory as HOME
	tmpDir := t.TempDir()
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	content := ReadEnvFile()
	if content != "" {
		t.Errorf("expected empty content for non-existent file, got '%s'", content)
	}
}
