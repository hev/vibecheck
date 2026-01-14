package schema

import (
	"encoding/json"

	"gopkg.in/yaml.v3"
)

// UnmarshalYAML implements custom YAML unmarshaling for Checks
// to handle both array (AND) and {or: [...]} (OR) formats
func (c *Checks) UnmarshalYAML(node *yaml.Node) error {
	// Try array format first (AND logic)
	if node.Kind == yaml.SequenceNode {
		var items []Check
		if err := node.Decode(&items); err != nil {
			return err
		}
		c.Items = items
		c.IsOr = false
		return nil
	}

	// Try object with 'or' property (OR logic)
	if node.Kind == yaml.MappingNode {
		var orWrapper struct {
			Or []Check `yaml:"or"`
		}
		if err := node.Decode(&orWrapper); err != nil {
			return err
		}
		c.Items = orWrapper.Or
		c.IsOr = true
		return nil
	}

	return nil
}

// MarshalYAML implements custom YAML marshaling for Checks
func (c Checks) MarshalYAML() (interface{}, error) {
	if c.IsOr {
		return map[string][]Check{"or": c.Items}, nil
	}
	return c.Items, nil
}

// UnmarshalJSON implements custom JSON unmarshaling for Checks
func (c *Checks) UnmarshalJSON(data []byte) error {
	// Try array format first (AND logic)
	var items []Check
	if err := json.Unmarshal(data, &items); err == nil {
		c.Items = items
		c.IsOr = false
		return nil
	}

	// Try object with 'or' property (OR logic)
	var orWrapper struct {
		Or []Check `json:"or"`
	}
	if err := json.Unmarshal(data, &orWrapper); err == nil && len(orWrapper.Or) > 0 {
		c.Items = orWrapper.Or
		c.IsOr = true
		return nil
	}

	return nil
}

// MarshalJSON implements custom JSON marshaling for Checks
func (c Checks) MarshalJSON() ([]byte, error) {
	if c.IsOr {
		return json.Marshal(map[string][]Check{"or": c.Items})
	}
	return json.Marshal(c.Items)
}

// Len returns the number of checks
func (c *Checks) Len() int {
	return len(c.Items)
}

// IsEmpty returns true if there are no checks
func (c *Checks) IsEmpty() bool {
	return len(c.Items) == 0
}
