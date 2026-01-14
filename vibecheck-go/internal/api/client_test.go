package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestClient creates a test client with a mock server
func TestClient_Get(t *testing.T) {
	// Create a mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request
		if r.Method != "GET" {
			t.Errorf("expected GET request, got %s", r.Method)
		}
		if r.URL.Path != "/api/test" {
			t.Errorf("expected path /api/test, got %s", r.URL.Path)
		}
		if auth := r.Header.Get("Authorization"); auth != "Bearer test-key" {
			t.Errorf("expected Authorization header 'Bearer test-key', got '%s'", auth)
		}

		// Send response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "success"})
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		apiKey:     "test-key",
		httpClient: http.DefaultClient,
	}

	var result map[string]string
	err := client.Get("/api/test", &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result["message"] != "success" {
		t.Errorf("expected message 'success', got '%s'", result["message"])
	}
}

func TestClient_Post(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST request, got %s", r.Method)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", ct)
		}

		// Verify body
		var body map[string]string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		if body["name"] != "test-name" {
			t.Errorf("expected name 'test-name', got '%s'", body["name"])
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"id": "123"})
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		apiKey:     "test-key",
		httpClient: http.DefaultClient,
	}

	var result map[string]string
	err := client.Post("/api/create", map[string]string{"name": "test-name"}, &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result["id"] != "123" {
		t.Errorf("expected id '123', got '%s'", result["id"])
	}
}

func TestClient_Delete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "DELETE" {
			t.Errorf("expected DELETE request, got %s", r.Method)
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		apiKey:     "test-key",
		httpClient: http.DefaultClient,
	}

	var result map[string]bool
	err := client.Delete("/api/item/123", &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result["success"] {
		t.Error("expected success true")
	}
}

func TestClient_AuthError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid API key"})
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		apiKey:     "bad-key",
		httpClient: http.DefaultClient,
	}

	var result map[string]string
	err := client.Get("/api/protected", &result)
	if err == nil {
		t.Fatal("expected error for 401 response")
	}

	if !IsAuthError(err) {
		t.Errorf("expected auth error, got: %v", err)
	}

	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.StatusCode != 401 {
		t.Errorf("expected status 401, got %d", apiErr.StatusCode)
	}
}

func TestClient_NotFoundError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Not found"})
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		apiKey:     "test-key",
		httpClient: http.DefaultClient,
	}

	var result map[string]string
	err := client.Get("/api/missing", &result)
	if err == nil {
		t.Fatal("expected error for 404 response")
	}

	if !IsNotFoundError(err) {
		t.Errorf("expected not found error, got: %v", err)
	}
}

func TestClient_PaymentError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusPaymentRequired)
		json.NewEncoder(w).Encode(map[string]string{"error": "Insufficient credits"})
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		apiKey:     "test-key",
		httpClient: http.DefaultClient,
	}

	var result map[string]string
	err := client.Get("/api/expensive", &result)
	if err == nil {
		t.Fatal("expected error for 402 response")
	}

	if !IsPaymentError(err) {
		t.Errorf("expected payment error, got: %v", err)
	}
}

func TestClient_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Internal server error"})
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		apiKey:     "test-key",
		httpClient: http.DefaultClient,
	}

	var result map[string]string
	err := client.Get("/api/broken", &result)
	if err == nil {
		t.Fatal("expected error for 500 response")
	}

	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.StatusCode != 500 {
		t.Errorf("expected status 500, got %d", apiErr.StatusCode)
	}
}

func TestClient_HasAPIKey(t *testing.T) {
	client := &Client{apiKey: ""}
	if client.HasAPIKey() {
		t.Error("expected HasAPIKey() to return false for empty key")
	}

	client.SetAPIKey("test-key")
	if !client.HasAPIKey() {
		t.Error("expected HasAPIKey() to return true after SetAPIKey()")
	}
}

func TestClient_DebugMode(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		apiKey:     "test-key",
		httpClient: http.DefaultClient,
		debug:      true,
	}

	// This should not panic and should complete normally
	var result map[string]string
	err := client.Get("/api/test", &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestAPIError_Error(t *testing.T) {
	err := &APIError{
		StatusCode: 400,
		Message:    "Bad request",
	}
	if err.Error() != "Bad request" {
		t.Errorf("expected 'Bad request', got '%s'", err.Error())
	}

	err2 := &APIError{
		StatusCode: 500,
		Body:       "server error body",
	}
	expected := "API error: 500 - server error body"
	if err2.Error() != expected {
		t.Errorf("expected '%s', got '%s'", expected, err2.Error())
	}
}

func TestIsAuthError_NonAPIError(t *testing.T) {
	err := http.ErrAbortHandler
	if IsAuthError(err) {
		t.Error("expected IsAuthError to return false for non-API error")
	}
}

func TestIsNotFoundError_NonAPIError(t *testing.T) {
	err := http.ErrAbortHandler
	if IsNotFoundError(err) {
		t.Error("expected IsNotFoundError to return false for non-API error")
	}
}

func TestIsPaymentError_NonAPIError(t *testing.T) {
	err := http.ErrAbortHandler
	if IsPaymentError(err) {
		t.Error("expected IsPaymentError to return false for non-API error")
	}
}

// TestMockOrgInfo tests the org info endpoint pattern
func TestMockOrgInfo(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/orginfo" {
			t.Errorf("expected /api/orginfo, got %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"name":    "Test Org",
			"slug":    "test-org",
			"status":  "active",
			"credits": 100.50,
		})
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		apiKey:     "test-key",
		httpClient: http.DefaultClient,
	}

	var result struct {
		Name    string  `json:"name"`
		Slug    string  `json:"slug"`
		Status  string  `json:"status"`
		Credits float64 `json:"credits"`
	}

	err := client.Get("/api/orginfo", &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Name != "Test Org" {
		t.Errorf("expected name 'Test Org', got '%s'", result.Name)
	}
	if result.Credits != 100.50 {
		t.Errorf("expected credits 100.50, got %f", result.Credits)
	}
}

// TestMockRunsList tests the runs list endpoint pattern
func TestMockRunsList(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/runs" {
			t.Errorf("expected /api/runs, got %s", r.URL.Path)
		}

		// Verify query params
		query := r.URL.Query()
		if limit := query.Get("limit"); limit != "10" {
			t.Errorf("expected limit=10, got %s", limit)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"runs": []map[string]interface{}{
				{
					"id":         "run-123",
					"suite_name": "test-suite",
					"model":      "anthropic/claude-3.5-sonnet",
					"status":     "completed",
				},
			},
			"pagination": map[string]interface{}{
				"total":   1,
				"hasMore": false,
			},
		})
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		apiKey:     "test-key",
		httpClient: http.DefaultClient,
	}

	var result struct {
		Runs []struct {
			ID        string `json:"id"`
			SuiteName string `json:"suite_name"`
			Model     string `json:"model"`
			Status    string `json:"status"`
		} `json:"runs"`
		Pagination struct {
			Total   int  `json:"total"`
			HasMore bool `json:"hasMore"`
		} `json:"pagination"`
	}

	err := client.Get("/api/runs?limit=10", &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.Runs) != 1 {
		t.Fatalf("expected 1 run, got %d", len(result.Runs))
	}
	if result.Runs[0].ID != "run-123" {
		t.Errorf("expected run id 'run-123', got '%s'", result.Runs[0].ID)
	}
}

// TestMockSaveSuite tests the save suite endpoint pattern
func TestMockSaveSuite(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/api/suite/save" {
			t.Errorf("expected /api/suite/save, got %s", r.URL.Path)
		}

		var body map[string]string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("failed to decode body: %v", err)
		}
		if body["yamlContent"] == "" {
			t.Error("expected yamlContent in body")
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"name":    "test-suite",
		})
	}))
	defer server.Close()

	client := &Client{
		baseURL:    server.URL,
		apiKey:     "test-key",
		httpClient: http.DefaultClient,
	}

	var result struct {
		Success bool   `json:"success"`
		Name    string `json:"name"`
	}

	err := client.Post("/api/suite/save", map[string]string{
		"yamlContent": "metadata:\n  name: test-suite",
	}, &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Success {
		t.Error("expected success true")
	}
}
