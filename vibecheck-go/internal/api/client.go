package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/fatih/color"
	"github.com/hev/vibecheck/internal/config"
)

// Client handles API requests with authentication
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	debug      bool
}

// APIError represents an error response from the API
type APIError struct {
	StatusCode int
	Message    string
	Body       string
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("API error: %d - %s", e.StatusCode, e.Body)
}

// NewClient creates a new API client
func NewClient(debug bool) *Client {
	return &Client{
		baseURL: config.GetAPIURL(),
		apiKey:  config.GetAPIKey(),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		debug: debug,
	}
}

// SetAPIKey allows setting the API key manually (for testing or special cases)
func (c *Client) SetAPIKey(key string) {
	c.apiKey = key
}

// HasAPIKey returns true if an API key is configured
func (c *Client) HasAPIKey() bool {
	return c.apiKey != ""
}

// debugLog prints debug information if debug mode is enabled
func (c *Client) debugLog(format string, args ...interface{}) {
	if c.debug {
		cyan := color.New(color.FgCyan)
		cyan.Printf("[DEBUG] "+format+"\n", args...)
	}
}

// doRequest performs an HTTP request with authentication
func (c *Client) doRequest(method, path string, body interface{}) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonData)
		c.debugLog("Request body: %s", string(jsonData))
	}

	url := c.baseURL + path
	c.debugLog("Request: %s %s", method, url)

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// Check for network errors
		return nil, fmt.Errorf("network error: %w", err)
	}

	c.debugLog("Response status: %d", resp.StatusCode)

	return resp, nil
}

// handleResponse processes the response and handles errors
func (c *Client) handleResponse(resp *http.Response, result interface{}) error {
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if c.debug && len(bodyBytes) > 0 {
		c.debugLog("Response body: %s", string(bodyBytes))
	}

	// Handle error status codes
	if resp.StatusCode >= 400 {
		return c.handleErrorResponse(resp.StatusCode, bodyBytes)
	}

	// Parse successful response
	if result != nil && len(bodyBytes) > 0 {
		if err := json.Unmarshal(bodyBytes, result); err != nil {
			return fmt.Errorf("failed to parse response: %w", err)
		}
	}

	return nil
}

// handleErrorResponse processes error responses
func (c *Client) handleErrorResponse(statusCode int, body []byte) error {
	apiErr := &APIError{
		StatusCode: statusCode,
		Body:       string(body),
	}

	// Try to parse error message from JSON
	var errResp struct {
		Error   string `json:"error"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(body, &errResp); err == nil {
		if errResp.Error != "" {
			apiErr.Message = errResp.Error
		} else if errResp.Message != "" {
			apiErr.Message = errResp.Message
		}
	}

	// Set user-friendly messages for common errors
	switch statusCode {
	case 401:
		if apiErr.Message == "" {
			apiErr.Message = "Invalid or missing API key. Please check your VIBECHECK_API_KEY."
		}
	case 402:
		if apiErr.Message == "" {
			apiErr.Message = "Insufficient credits. Please add more credits at vibescheck.io."
		}
	case 404:
		if apiErr.Message == "" {
			apiErr.Message = "Resource not found."
		}
	case 500:
		if apiErr.Message == "" {
			apiErr.Message = "Server error. Please try again later."
		}
	}

	return apiErr
}

// Get performs a GET request
func (c *Client) Get(path string, result interface{}) error {
	resp, err := c.doRequest("GET", path, nil)
	if err != nil {
		return err
	}
	return c.handleResponse(resp, result)
}

// Post performs a POST request
func (c *Client) Post(path string, body interface{}, result interface{}) error {
	resp, err := c.doRequest("POST", path, body)
	if err != nil {
		return err
	}
	return c.handleResponse(resp, result)
}

// Delete performs a DELETE request
func (c *Client) Delete(path string, result interface{}) error {
	resp, err := c.doRequest("DELETE", path, nil)
	if err != nil {
		return err
	}
	return c.handleResponse(resp, result)
}

// IsAuthError returns true if the error is an authentication error
func IsAuthError(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode == 401
	}
	return false
}

// IsNotFoundError returns true if the error is a 404 error
func IsNotFoundError(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode == 404
	}
	return false
}

// IsPaymentError returns true if the error is a payment/credits error
func IsPaymentError(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode == 402
	}
	return false
}
