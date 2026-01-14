package display

import (
	"fmt"

	"github.com/fatih/color"
)

var (
	successColor = color.New(color.FgGreen)
	errorColor   = color.New(color.FgRed)
	warnColor    = color.New(color.FgYellow)
	infoColor    = color.New(color.FgCyan)
	grayColor    = color.New(color.FgHiBlack)
	boldColor    = color.New(color.Bold)
)

// Success prints a success message in green
func Success(format string, args ...interface{}) {
	successColor.Printf(format+"\n", args...)
}

// Error prints an error message in red
func Error(format string, args ...interface{}) {
	errorColor.Printf(format+"\n", args...)
}

// Warn prints a warning message in yellow
func Warn(format string, args ...interface{}) {
	warnColor.Printf(format+"\n", args...)
}

// Info prints an info message in cyan
func Info(format string, args ...interface{}) {
	infoColor.Printf(format+"\n", args...)
}

// Gray prints a message in gray
func Gray(format string, args ...interface{}) {
	grayColor.Printf(format+"\n", args...)
}

// Bold prints a bold message
func Bold(format string, args ...interface{}) {
	boldColor.Printf(format+"\n", args...)
}

// Print prints a message without newline
func Print(format string, args ...interface{}) {
	fmt.Printf(format, args...)
}

// Println prints a message with newline
func Println(format string, args ...interface{}) {
	fmt.Printf(format+"\n", args...)
}

// SuccessRateColor returns the appropriate color based on success rate
// Green (>80%), Yellow (50-80%), Red (<50%)
func SuccessRateColor(rate float64) *color.Color {
	if rate >= 80 {
		return successColor
	} else if rate >= 50 {
		return warnColor
	}
	return errorColor
}

// FormatSuccessRate formats a success rate with color
func FormatSuccessRate(rate float64) string {
	c := SuccessRateColor(rate)
	return c.Sprintf("%.1f%%", rate)
}

// PassIcon returns a check or X based on passed status
func PassIcon(passed bool) string {
	if passed {
		return successColor.Sprint("✓")
	}
	return errorColor.Sprint("✗")
}

// PassStatus returns "PASS" or "FAIL" with appropriate color
func PassStatus(passed bool) string {
	if passed {
		return successColor.Sprint("✅ PASS")
	}
	return errorColor.Sprint("❌ FAIL")
}
