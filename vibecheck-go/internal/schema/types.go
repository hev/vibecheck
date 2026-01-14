package schema

// EvalSuite represents a complete evaluation suite
type EvalSuite struct {
	Metadata EvalSuiteMetadata `yaml:"metadata" json:"metadata"`
	Evals    []Eval            `yaml:"evals" json:"evals"`
}

// EvalSuiteMetadata contains suite configuration
type EvalSuiteMetadata struct {
	Name         string     `yaml:"name" json:"name"`
	Model        string     `yaml:"model" json:"model"`
	SystemPrompt string     `yaml:"system_prompt,omitempty" json:"system_prompt,omitempty"`
	Threads      int        `yaml:"threads,omitempty" json:"threads,omitempty"`
	MCPServer    *MCPServer `yaml:"mcp_server,omitempty" json:"mcp_server,omitempty"`
}

// MCPServer represents MCP server configuration
type MCPServer struct {
	URL                string `yaml:"url" json:"url"`
	Name               string `yaml:"name" json:"name"`
	AuthorizationToken string `yaml:"authorization_token,omitempty" json:"authorization_token,omitempty"`
}

// Eval represents a single evaluation with its prompt and checks
type Eval struct {
	Prompt string `yaml:"prompt" json:"prompt"`
	Checks Checks `yaml:"checks" json:"checks"`
}

// SemanticCheck represents a semantic similarity check
type SemanticCheck struct {
	Expected  string  `yaml:"expected" json:"expected"`
	Threshold float64 `yaml:"threshold" json:"threshold"`
}

// LLMJudgeCheck represents an LLM-based judgment check
type LLMJudgeCheck struct {
	Criteria string `yaml:"criteria" json:"criteria"`
}

// Check represents a single check condition
type Check struct {
	Match     string         `yaml:"match,omitempty" json:"match,omitempty"`
	NotMatch  string         `yaml:"not_match,omitempty" json:"not_match,omitempty"`
	MinTokens int            `yaml:"min_tokens,omitempty" json:"min_tokens,omitempty"`
	MaxTokens int            `yaml:"max_tokens,omitempty" json:"max_tokens,omitempty"`
	Semantic  *SemanticCheck `yaml:"semantic,omitempty" json:"semantic,omitempty"`
	LLMJudge  *LLMJudgeCheck `yaml:"llm_judge,omitempty" json:"llm_judge,omitempty"`
	Or        []Check        `yaml:"or,omitempty" json:"or,omitempty"`
}

// IsEmpty returns true if the check has no conditions set
func (c *Check) IsEmpty() bool {
	return c.Match == "" &&
		c.NotMatch == "" &&
		c.MinTokens == 0 &&
		c.MaxTokens == 0 &&
		c.Semantic == nil &&
		c.LLMJudge == nil &&
		len(c.Or) == 0
}

// CheckType returns a string describing what kind of check this is
func (c *Check) CheckType() string {
	switch {
	case c.Match != "":
		return "match"
	case c.NotMatch != "":
		return "not_match"
	case c.MinTokens > 0:
		return "min_tokens"
	case c.MaxTokens > 0:
		return "max_tokens"
	case c.Semantic != nil:
		return "semantic"
	case c.LLMJudge != nil:
		return "llm_judge"
	case len(c.Or) > 0:
		return "or"
	default:
		return "unknown"
	}
}

// Checks represents a collection of checks with AND/OR logic
type Checks struct {
	Items []Check
	IsOr  bool
}

// ConditionalResult represents the result of a check execution
type ConditionalResult struct {
	Type     string              `json:"type"`
	Passed   bool                `json:"passed"`
	Message  string              `json:"message"`
	Children []ConditionalResult `json:"children,omitempty"`
}

// EvalResult represents the result of a single evaluation
type EvalResult struct {
	EvalName        string              `json:"evalName"`
	Prompt          string              `json:"prompt"`
	Response        string              `json:"response"`
	CheckResults    []ConditionalResult `json:"checkResults"`
	Passed          bool                `json:"passed"`
	ExecutionTimeMs int64               `json:"executionTimeMs,omitempty"`
	Cost            float64             `json:"cost,omitempty"`
}

// EvalRunResult represents the result of a complete suite run
type EvalRunResult struct {
	SuiteID   string       `json:"suiteId"`
	SuiteName string       `json:"suiteName"`
	Results   []EvalResult `json:"results"`
}

// RunStatus represents possible run status values
type RunStatus string

const (
	RunStatusQueued     RunStatus = "queued"
	RunStatusRunning    RunStatus = "running"
	RunStatusCompleted  RunStatus = "completed"
	RunStatusFailed     RunStatus = "failed"
	RunStatusCancelled  RunStatus = "cancelled"
)

// Run represents a run record from the API
type Run struct {
	ID               string    `json:"id"`
	SuiteName        string    `json:"suiteName"`
	Model            string    `json:"model"`
	Status           RunStatus `json:"status"`
	SuccessRate      float64   `json:"successRate"`
	TotalCost        float64   `json:"totalCost"`
	TotalTimeSeconds float64   `json:"totalTimeSeconds"`
	CreatedAt        string    `json:"createdAt"`
	CompletedAt      string    `json:"completedAt,omitempty"`
	Results          []EvalResult `json:"results,omitempty"`
}

// Model represents a model available in the API
type Model struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Provider   string  `json:"provider"`
	PriceTier  int     `json:"priceTier"`
	MCPSupport bool    `json:"mcpSupport"`
	InputCost  float64 `json:"inputCost"`
	OutputCost float64 `json:"outputCost"`
}

// OrgInfo represents organization information
type OrgInfo struct {
	Name       string  `json:"name"`
	Credits    float64 `json:"credits"`
	Status     string  `json:"status"`
}

// Variable represents a runtime variable
type Variable struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Secret represents a runtime secret (value is write-only)
type Secret struct {
	Name string `json:"name"`
}
