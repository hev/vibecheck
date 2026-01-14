package main

import (
	"os"

	"github.com/hev/vibecheck/internal/cli"
)

func main() {
	if err := cli.Execute(); err != nil {
		os.Exit(1)
	}
}
