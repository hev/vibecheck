#!/bin/bash

# VibeCheck CLI Publishing Script
# This script handles the complete publishing process with safety checks

set -e  # Exit on any error

echo "🚀 VibeCheck CLI Publishing Script"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages/cli" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if we're logged into npm
if ! npm whoami > /dev/null 2>&1; then
    echo "❌ Error: Not logged into npm. Please run 'npm login' first"
    exit 1
fi

echo "✅ npm authentication verified"

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

# Check if version needs to be updated
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

# Publish to npm
echo "📤 Publishing to npm..."
npm publish --access public

if [ $? -eq 0 ]; then
    echo "🎉 Successfully published @vibecheck/cli to npm!"
    echo "📋 Next steps:"
    echo "   - Create a git tag: git tag v$(node -p "require('./package.json').version")"
    echo "   - Push the tag: git push origin v$(node -p "require('./package.json').version")"
    echo "   - Update documentation if needed"
else
    echo "❌ Publishing failed"
    exit 1
fi

cd ../..
echo "✨ Publishing complete!"
