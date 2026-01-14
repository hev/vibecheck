package cli

import (
	"testing"
)

func TestCalculatePricePerformanceScore(t *testing.T) {
	tests := []struct {
		name            string
		successPct      float64
		totalCost       *float64
		durationSeconds *float64
		expectNil       bool
		expectedScore   float64
	}{
		{
			name:       "nil cost returns nil",
			successPct: 80.0,
			totalCost:  nil,
			expectNil:  true,
		},
		{
			name:       "zero cost returns nil",
			successPct: 80.0,
			totalCost:  floatPtr(0),
			expectNil:  true,
		},
		{
			name:            "valid inputs",
			successPct:      80.0,
			totalCost:       floatPtr(0.01),
			durationSeconds: floatPtr(10.0),
			expectNil:       false,
			expectedScore:   7.27, // 80 / (0.01*1000 + 10*0.1) = 80/11 ≈ 7.27
		},
		{
			name:            "no duration penalty",
			successPct:      100.0,
			totalCost:       floatPtr(0.01),
			durationSeconds: nil,
			expectNil:       false,
			expectedScore:   10.0, // 100 / (0.01*1000) = 100/10 = 10
		},
		{
			name:       "negative success rate returns nil",
			successPct: -10.0,
			totalCost:  floatPtr(0.01),
			expectNil:  true,
		},
		{
			name:       "success rate over 100 returns nil",
			successPct: 150.0,
			totalCost:  floatPtr(0.01),
			expectNil:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculatePricePerformanceScore(tt.successPct, tt.totalCost, tt.durationSeconds)
			if tt.expectNil {
				if result != nil {
					t.Errorf("expected nil, got %f", *result)
				}
			} else {
				if result == nil {
					t.Fatal("expected non-nil result")
				}
				// Allow some floating point tolerance
				diff := *result - tt.expectedScore
				if diff < -0.1 || diff > 0.1 {
					t.Errorf("expected score ~%f, got %f", tt.expectedScore, *result)
				}
			}
		})
	}
}

func TestEscapeCSVField(t *testing.T) {
	tests := []struct {
		input    interface{}
		expected string
	}{
		{nil, ""},
		{"simple", "simple"},
		{"with,comma", "\"with,comma\""},
		{"with\"quote", "\"with\"\"quote\""},
		{"with\nnewline", "\"with\nnewline\""},
		{123, "123"},
		{45.67, "45.67"},
		{"normal text", "normal text"},
	}

	for _, tt := range tests {
		result := escapeCSVField(tt.input)
		if result != tt.expected {
			t.Errorf("escapeCSVField(%v) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestSortRuns_ByCreated(t *testing.T) {
	runs := []RunData{
		{ID: "1", CreatedAt: "2024-01-01T10:00:00Z"},
		{ID: "2", CreatedAt: "2024-01-03T10:00:00Z"},
		{ID: "3", CreatedAt: "2024-01-02T10:00:00Z"},
	}

	sortRuns(runs, "created")

	// Should be newest first
	if runs[0].ID != "2" || runs[1].ID != "3" || runs[2].ID != "1" {
		t.Errorf("unexpected order after sort by created: %s, %s, %s",
			runs[0].ID, runs[1].ID, runs[2].ID)
	}
}

func TestSortRuns_BySuccess(t *testing.T) {
	runs := []RunData{
		{ID: "1", SuccessPercentage: 50.0},
		{ID: "2", SuccessPercentage: 90.0},
		{ID: "3", SuccessPercentage: 70.0},
	}

	sortRuns(runs, "success")

	// Should be highest success first
	if runs[0].ID != "2" || runs[1].ID != "3" || runs[2].ID != "1" {
		t.Errorf("unexpected order after sort by success: %s, %s, %s",
			runs[0].ID, runs[1].ID, runs[2].ID)
	}
}

func TestSortRuns_ByCost(t *testing.T) {
	runs := []RunData{
		{ID: "1", TotalCost: floatPtr(0.05)},
		{ID: "2", TotalCost: floatPtr(0.01)},
		{ID: "3", TotalCost: floatPtr(0.03)},
	}

	sortRuns(runs, "cost")

	// Should be lowest cost first
	if runs[0].ID != "2" || runs[1].ID != "3" || runs[2].ID != "1" {
		t.Errorf("unexpected order after sort by cost: %s, %s, %s",
			runs[0].ID, runs[1].ID, runs[2].ID)
	}
}

func TestSortRuns_ByTime(t *testing.T) {
	runs := []RunData{
		{ID: "1", DurationSeconds: floatPtr(30.0)},
		{ID: "2", DurationSeconds: floatPtr(10.0)},
		{ID: "3", DurationSeconds: floatPtr(20.0)},
	}

	sortRuns(runs, "time")

	// Should be fastest first
	if runs[0].ID != "2" || runs[1].ID != "3" || runs[2].ID != "1" {
		t.Errorf("unexpected order after sort by time: %s, %s, %s",
			runs[0].ID, runs[1].ID, runs[2].ID)
	}
}

func TestSortRuns_ByPricePerformance(t *testing.T) {
	runs := []RunData{
		{ID: "1", Status: "completed", SuccessPercentage: 80.0, TotalCost: floatPtr(0.02)},  // 80/20 = 4
		{ID: "2", Status: "completed", SuccessPercentage: 90.0, TotalCost: floatPtr(0.01)},  // 90/10 = 9
		{ID: "3", Status: "running", SuccessPercentage: 100.0, TotalCost: floatPtr(0.005)},  // Ineligible
		{ID: "4", Status: "completed", SuccessPercentage: 60.0, TotalCost: floatPtr(0.01)},  // 60/10 = 6
	}

	sortRuns(runs, "price-performance")

	// Should be highest score first, ineligible at end
	if runs[0].ID != "2" {
		t.Errorf("expected ID 2 first (highest score), got %s", runs[0].ID)
	}
	if runs[1].ID != "4" {
		t.Errorf("expected ID 4 second, got %s", runs[1].ID)
	}
	if runs[2].ID != "1" {
		t.Errorf("expected ID 1 third, got %s", runs[2].ID)
	}
	if runs[3].ID != "3" {
		t.Errorf("expected ID 3 last (ineligible), got %s", runs[3].ID)
	}
}

func TestPad(t *testing.T) {
	tests := []struct {
		input    string
		width    int
		expected string
	}{
		{"test", 10, "test      "},
		{"longstring", 5, "long…"},
		{"exact", 5, "exact"},
		{"", 3, "   "},
	}

	for _, tt := range tests {
		result := pad(tt.input, tt.width)
		if result != tt.expected {
			t.Errorf("pad(%q, %d) = %q, want %q", tt.input, tt.width, result, tt.expected)
		}
	}
}

func TestParsePriceQuartiles(t *testing.T) {
	tests := []struct {
		input    string
		expected []int
	}{
		{"", nil},
		{"1", []int{1}},
		{"1,2", []int{1, 2}},
		{"1,2,3,4", []int{1, 2, 3, 4}},
		{"1, 3", []int{1, 3}},
		{"0,5", nil}, // Invalid values
		{"a,b", nil}, // Invalid values
	}

	for _, tt := range tests {
		result := parsePriceQuartiles(tt.input)
		if len(result) != len(tt.expected) {
			t.Errorf("parsePriceQuartiles(%q) = %v, want %v", tt.input, result, tt.expected)
			continue
		}
		for i := range result {
			if result[i] != tt.expected[i] {
				t.Errorf("parsePriceQuartiles(%q)[%d] = %d, want %d", tt.input, i, result[i], tt.expected[i])
			}
		}
	}
}

func TestParseProviders(t *testing.T) {
	tests := []struct {
		input    string
		expected []string
	}{
		{"", nil},
		{"openai", []string{"openai"}},
		{"openai,anthropic", []string{"openai", "anthropic"}},
		{"OpenAI, Anthropic", []string{"openai", "anthropic"}}, // Lowercased
	}

	for _, tt := range tests {
		result := parseProviders(tt.input)
		if len(result) != len(tt.expected) {
			t.Errorf("parseProviders(%q) = %v, want %v", tt.input, result, tt.expected)
			continue
		}
		for i := range result {
			if result[i] != tt.expected[i] {
				t.Errorf("parseProviders(%q)[%d] = %q, want %q", tt.input, i, result[i], tt.expected[i])
			}
		}
	}
}

func TestColorizePriceTier(t *testing.T) {
	tests := []string{"$", "$$", "$$$", "$$$$", "-", ""}
	for _, tier := range tests {
		result := colorizePriceTier(tier)
		// Just verify it doesn't panic and returns something
		if result == "" && tier != "" {
			t.Errorf("colorizePriceTier(%q) returned empty string", tier)
		}
	}
}

func TestTruncateForDisplay(t *testing.T) {
	tests := []struct {
		input    string
		maxLen   int
		expected string
	}{
		{"short", 10, "short"},
		{"exactly ten", 11, "exactly ten"},
		{"this is a very long string", 10, "this is..."},
		{"abc", 3, "abc"},
		{"", 5, ""},
	}

	for _, tt := range tests {
		result := truncateForDisplay(tt.input, tt.maxLen)
		if result != tt.expected {
			t.Errorf("truncateForDisplay(%q, %d) = %q, want %q", tt.input, tt.maxLen, result, tt.expected)
		}
	}
}

func TestFormatTime(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", "-"},
		{"invalid", "invalid"},
		{"2024-01-15T10:30:00Z", "Jan 15, 10:30"}, // Will vary by timezone
	}

	for _, tt := range tests {
		result := formatTime(tt.input)
		if tt.input == "" && result != tt.expected {
			t.Errorf("formatTime(%q) = %q, want %q", tt.input, result, tt.expected)
		}
		// For valid times, just check it doesn't return empty or the original
		if tt.input != "" && tt.input != "invalid" && result == tt.input {
			t.Errorf("formatTime(%q) should have formatted the time", tt.input)
		}
	}
}

// Helper to create float pointers
func floatPtr(f float64) *float64 {
	return &f
}
