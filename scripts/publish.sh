#!/bin/bash

# vibecheck CLI Publishing Script
# This script handles the complete publishing process with safety checks

set -e  # Exit on any error

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            echo "Usage: $0"
            echo ""
            echo "This script publishes the vibecheck CLI to npm and creates a GitHub release."
            echo ""
            echo "Options:"
            echo "  --help, -h        Show this help message"
            echo ""
            echo "Prerequisites:"
            echo "  - Must be logged into npm (npm login)"
            echo "  - Must have gh CLI installed and authenticated (gh auth login)"
            echo "  - Working directory must be clean (no uncommitted changes)"
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

# Check if we're logged into npm
if ! npm whoami > /dev/null 2>&1; then
    echo "❌ Error: Not logged into npm. Please run 'npm login' first"
    exit 1
fi
echo "✅ npm authentication verified"

# Check if gh CLI is installed and authenticated
if ! command -v gh &> /dev/null; then
    echo "❌ Error: gh CLI is not installed. Please install it first: brew install gh"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "❌ Error: Not authenticated with gh CLI. Please run 'gh auth login' first"
    exit 1
fi
echo "✅ GitHub CLI authentication verified"

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

# Check package version and prompt for version bump
echo "📦 Checking package version..."
cd packages/cli
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Also check root package.json version
ROOT_VERSION=$(node -p "require('../../package.json').version")
if [ "$CURRENT_VERSION" != "$ROOT_VERSION" ]; then
    echo "⚠️  Warning: Version mismatch between root ($ROOT_VERSION) and CLI ($CURRENT_VERSION)"
    echo "   Both versions will be updated together"
fi

# Ask for version bump
echo "Version bump options:"
echo "1) patch (0.1.0 -> 0.1.1)"
echo "2) minor (0.1.0 -> 0.2.0)" 
echo "3) major (0.1.0 -> 1.0.0)"
echo "4) Skip version bump"
read -p "Choose option (1-4): " -n 1 -r
echo

NEW_VERSION=""
case $REPLY in
    1)
        npm version patch --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        # Update root package.json version
        cd ../..
        npm version patch --no-git-tag-version
        cd packages/cli
        ;;
    2)
        npm version minor --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        # Update root package.json version
        cd ../..
        npm version minor --no-git-tag-version
        cd packages/cli
        ;;
    3)
        npm version major --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        # Update root package.json version
        cd ../..
        npm version major --no-git-tag-version
        cd packages/cli
        ;;
    4)
        echo "Skipping version bump"
        NEW_VERSION=$CURRENT_VERSION
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
    echo "🎉 Successfully published vibecheck-cli to npm!"
else
    echo "❌ npm publishing failed"
    exit 1
fi

# Extract release notes from CHANGELOG.md
cd ../..
echo "📝 Extracting release notes from CHANGELOG.md..."

if [ -z "$NEW_VERSION" ]; then
    NEW_VERSION=$(node -p "require('./packages/cli/package.json').version")
fi

# Extract the section for the new version from CHANGELOG.md
RELEASE_NOTES_FILE=$(mktemp)
VERSION_HEADER="## $NEW_VERSION"

# Find the version section and extract until the next version header
FOUND_VERSION=false
while IFS= read -r line; do
    if [[ "$line" == "$VERSION_HEADER"* ]]; then
        FOUND_VERSION=true
        echo "$line" >> "$RELEASE_NOTES_FILE"
    elif [[ "$FOUND_VERSION" == true ]]; then
        if [[ "$line" == "## "* ]] && [[ "$line" != "$VERSION_HEADER"* ]]; then
            break
        fi
        echo "$line" >> "$RELEASE_NOTES_FILE"
    fi
done < CHANGELOG.md

if [ "$FOUND_VERSION" == false ]; then
    echo "⚠️  Warning: Could not find version $NEW_VERSION in CHANGELOG.md"
    echo "   Creating release with basic notes..."
    echo "## $NEW_VERSION" > "$RELEASE_NOTES_FILE"
    echo "" >> "$RELEASE_NOTES_FILE"
    echo "See CHANGELOG.md for details." >> "$RELEASE_NOTES_FILE"
fi

# Create git tag and GitHub release
TAG_NAME="v$NEW_VERSION"
echo "🏷️  Creating git tag and GitHub release..."

# Check if tag already exists (locally or remotely)
TAG_EXISTS_LOCALLY=false
TAG_EXISTS_REMOTE=false

if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    TAG_EXISTS_LOCALLY=true
fi

# Check if tag exists on remote
if git ls-remote --tags origin "$TAG_NAME" | grep -q "$TAG_NAME"; then
    TAG_EXISTS_REMOTE=true
fi

if [ "$TAG_EXISTS_LOCALLY" == true ] || [ "$TAG_EXISTS_REMOTE" == true ]; then
    if [ "$TAG_EXISTS_LOCALLY" == false ]; then
        # Tag exists on remote but not locally, fetch it
        git fetch origin tag "$TAG_NAME"
    fi
    echo "⚠️  Tag $TAG_NAME already exists. Skipping tag creation."
else
    # Create and push the tag
    git tag "$TAG_NAME"
    git push origin "$TAG_NAME"
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to push tag to remote"
        rm -f "$RELEASE_NOTES_FILE"
        exit 1
    fi
    echo "✅ Tag $TAG_NAME created and pushed"
fi

# Create GitHub release
gh release create "$TAG_NAME" \
    --title "$TAG_NAME" \
    --notes-file "$RELEASE_NOTES_FILE"

if [ $? -eq 0 ]; then
    echo "🎉 Successfully created GitHub release $TAG_NAME!"
else
    echo "⚠️  Failed to create GitHub release (tag was still created)"
    rm -f "$RELEASE_NOTES_FILE"
    exit 1
fi

# Clean up
rm -f "$RELEASE_NOTES_FILE"

echo ""
echo "✨ Publishing complete!"
echo "   - Published to npm: vibecheck-cli@$NEW_VERSION"
echo "   - Created GitHub release: $TAG_NAME"
