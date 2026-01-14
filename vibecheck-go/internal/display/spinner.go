package display

import (
	"time"

	"github.com/briandowns/spinner"
)

// Spinner wraps the briandowns/spinner for consistent usage
type Spinner struct {
	s *spinner.Spinner
}

// NewSpinner creates a new spinner with the given message
func NewSpinner(message string) *Spinner {
	s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
	s.Suffix = " " + message
	return &Spinner{s: s}
}

// Start starts the spinner
func (sp *Spinner) Start() {
	sp.s.Start()
}

// Stop stops the spinner
func (sp *Spinner) Stop() {
	sp.s.Stop()
}

// Success stops the spinner with a success message
func (sp *Spinner) Success(message string) {
	sp.s.Stop()
	Success(message)
}

// Fail stops the spinner with a failure message
func (sp *Spinner) Fail(message string) {
	sp.s.Stop()
	Error(message)
}

// UpdateMessage changes the spinner message
func (sp *Spinner) UpdateMessage(message string) {
	sp.s.Suffix = " " + message
}
