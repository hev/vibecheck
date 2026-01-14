.PHONY: build build-all install test lint clean release

# Version info
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

# Build flags
LDFLAGS := -ldflags "-X github.com/hev/vibecheck/internal/cli.CLIVersion=$(VERSION) \
	-X github.com/hev/vibecheck/internal/cli.Commit=$(COMMIT) \
	-X github.com/hev/vibecheck/internal/cli.BuildDate=$(BUILD_DATE)"

# Output directories
BUILD_DIR := build
DIST_DIR := dist

# Binary name
BINARY := vibe

# Build for current platform
build:
	go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY) ./cmd/vibe

# Cross-compile for all platforms
build-all: clean
	@mkdir -p $(DIST_DIR)
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o $(DIST_DIR)/$(BINARY)-darwin-amd64 ./cmd/vibe
	GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o $(DIST_DIR)/$(BINARY)-darwin-arm64 ./cmd/vibe
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(DIST_DIR)/$(BINARY)-linux-amd64 ./cmd/vibe
	GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o $(DIST_DIR)/$(BINARY)-linux-arm64 ./cmd/vibe
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o $(DIST_DIR)/$(BINARY)-windows-amd64.exe ./cmd/vibe

# Install to GOPATH/bin
install:
	go install $(LDFLAGS) ./cmd/vibe

# Run tests
test:
	go test -v ./...

# Run tests with coverage
test-coverage:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Run linter
lint:
	golangci-lint run ./...

# Clean build artifacts
clean:
	rm -rf $(BUILD_DIR) $(DIST_DIR)
	rm -f coverage.out coverage.html

# Create release binaries with checksums
release: build-all
	@cd $(DIST_DIR) && shasum -a 256 * > checksums.txt
	@echo "Release binaries created in $(DIST_DIR)/"

# Development helpers
dev: build
	./$(BUILD_DIR)/$(BINARY)

# Download dependencies
deps:
	go mod download
	go mod tidy

# Format code
fmt:
	go fmt ./...

# Run the CLI with arguments (usage: make run ARGS="check -f test.yaml")
run: build
	./$(BUILD_DIR)/$(BINARY) $(ARGS)
