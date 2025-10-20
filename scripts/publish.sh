#!/bin/bash

# vibecheck CLI Publishing Script
# This script handles the complete publishing process with safety checks

set -e  # Exit on any error

# Default values
PUBLISH_NPM=true
PUBLISH_HOMEBREW=false
AUTO_HOMEBREW=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --npm-only)
            PUBLISH_NPM=true
            PUBLISH_HOMEBREW=false
            AUTO_HOMEBREW=false
            shift
            ;;
        --homebrew-only)
            PUBLISH_NPM=false
            PUBLISH_HOMEBREW=true
            AUTO_HOMEBREW=false
            shift
            ;;
        --auto-homebrew)
            AUTO_HOMEBREW=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --npm-only        Publish only to npm (default)"
            echo "  --homebrew-only   Publish only to Homebrew tap"
            echo "  --auto-homebrew   Publish to npm and automatically to Homebrew (no prompt)"
            echo "  --help, -h        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Publish to npm, ask about Homebrew"
            echo "  $0 --npm-only         # Publish only to npm"
            echo "  $0 --homebrew-only    # Publish only to Homebrew"
            echo "  $0 --auto-homebrew    # Publish to both npm and Homebrew automatically"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🚀 vibecheck CLI Publishing Script"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages/cli" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if we're logged into npm (only if npm publishing is enabled)
if [ "$PUBLISH_NPM" = true ]; then
    if ! npm whoami > /dev/null 2>&1; then
        echo "❌ Error: Not logged into npm. Please run 'npm login' first"
        exit 1
    fi
    echo "✅ npm authentication verified"
fi

# Check if we're on the main branch (optional check)
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "0.1.0" ]; then
    echo "⚠️  Warning: You're on branch '$CURRENT_BRANCH', not main/0.1.0"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Publishing cancelled"
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: You have uncommitted changes. Please commit or stash them first"
    git status --short
    exit 1
fi

echo "✅ Git working directory is clean"

# Run tests
echo "🧪 Running tests..."
npm run test:unit
npm run test:integration

if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Please fix them before publishing"
    exit 1
fi

echo "✅ All tests passed"

# Build all packages
echo "🔨 Building packages..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix build errors before publishing"
    exit 1
fi

echo "✅ Build completed successfully"

# Check if version needs to be updated (only if npm publishing is enabled)
if [ "$PUBLISH_NPM" = true ]; then
    echo "📦 Checking package version..."
    cd packages/cli
    CURRENT_VERSION=$(node -p "require('./package.json').version")
    echo "Current version: $CURRENT_VERSION"

    # Ask for version bump
    echo "Version bump options:"
    echo "1) patch (0.1.0 -> 0.1.1)"
    echo "2) minor (0.1.0 -> 0.2.0)" 
    echo "3) major (0.1.0 -> 1.0.0)"
    echo "4) Skip version bump"
    read -p "Choose option (1-4): " -n 1 -r
    echo

    case $REPLY in
        1)
            npm version patch
            ;;
        2)
            npm version minor
            ;;
        3)
            npm version major
            ;;
        4)
            echo "Skipping version bump"
            ;;
        *)
            echo "❌ Invalid option. Publishing cancelled"
            exit 1
            ;;
    esac
else
    # For Homebrew-only publishing, just navigate to the CLI directory
    cd packages/cli
fi

# Publish to npm (if enabled)
if [ "$PUBLISH_NPM" = true ]; then
    echo "📤 Publishing to npm..."
    npm publish --access public

    if [ $? -eq 0 ]; then
        echo "🎉 Successfully published @vibe/cli to npm!"
    else
        echo "❌ npm publishing failed"
        exit 1
    fi
fi

# Publish to Homebrew (if enabled or auto-enabled)
if [ "$PUBLISH_HOMEBREW" = true ] || [ "$AUTO_HOMEBREW" = true ]; then
    echo ""
    echo "🍺 Homebrew Publishing"
    echo "====================="
    
    if [ "$AUTO_HOMEBREW" = true ]; then
        echo "📦 Publishing to Homebrew tap automatically..."
    else
        read -p "Do you want to publish to Homebrew tap as well? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "📦 Publishing to Homebrew tap..."
        else
            echo "Skipping Homebrew publishing"
            PUBLISH_HOMEBREW=false
        fi
    fi
    
    if [ "$PUBLISH_HOMEBREW" = true ] || [ "$AUTO_HOMEBREW" = true ]; then
        ../scripts/publish-homebrew.sh
        
        if [ $? -eq 0 ]; then
            echo "🎉 Successfully published to Homebrew tap!"
        else
            echo "⚠️  Homebrew publishing failed"
            if [ "$PUBLISH_NPM" = false ]; then
                echo "❌ Homebrew was the only target and it failed"
                exit 1
            else
                echo "ℹ️  npm publishing was successful"
            fi
        fi
    fi
fi

# Show next steps
echo ""
echo "📋 Next steps:"
if [ "$PUBLISH_NPM" = true ]; then
    echo "   - Create a git tag: git tag v$(node -p "require('./package.json').version")"
    echo "   - Push the tag: git push origin v$(node -p "require('./package.json').version")"
fi
echo "   - Update documentation if needed"

cd ../..
echo "✨ Publishing complete!"
