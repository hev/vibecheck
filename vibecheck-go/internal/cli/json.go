package cli

import (
	"encoding/json"
	"io"
)

// decodeJSON decodes JSON from a reader into the target struct
func decodeJSON(r io.Reader, v interface{}) error {
	return json.NewDecoder(r).Decode(v)
}
