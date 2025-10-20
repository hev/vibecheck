#!/bin/bash

# Homebrew Publishing Script for vibe CLI
# This script helps publish the vibe CLI to a Homebrew tap

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TAP_REPO="yourusername/vibe"  # Update this to your actual GitHub username
FORMULA_FILE="scripts/homebrew/vibe.rb"
TAP_DIR="vibe"

echo -e "${BLUE}🍺 Homebrew Publishing Script for vibe CLI${NC}"
echo "================================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in the project root directory${NC}"
    echo "Please run this script from the vibecheck project root"
    exit 1
fi

# Get current version
VERSION=$(node -p "require('./packages/cli/package.json').version")
echo -e "${BLUE}📦 Current version: ${VERSION}${NC}"

# Check if tap directory exists
if [ ! -d "$TAP_DIR" ]; then
    echo -e "${YELLOW}📁 Tap directory not found. Cloning...${NC}"
    git clone "https://github.com/$TAP_REPO.git" "$TAP_DIR"
fi

# Navigate to tap directory
cd "$TAP_DIR"

# Pull latest changes
echo -e "${BLUE}🔄 Updating tap repository...${NC}"
git pull origin main

# Copy formula file
echo -e "${BLUE}📋 Copying formula file...${NC}"
cp "../$FORMULA_FILE" "vibe.rb"

# Update formula with new version and SHA
echo -e "${BLUE}🔧 Updating formula...${NC}"

# Get the npm tarball URL and SHA
NPM_TARBALL_URL="https://registry.npmjs.org/@vibe/cli/-/@vibe/cli-${VERSION}.tgz"
echo -e "${YELLOW}📥 Fetching tarball from npm...${NC}"

# Download tarball to get SHA
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"
curl -s "$NPM_TARBALL_URL" -o "vibe-cli.tgz"
SHA256=$(shasum -a 256 "vibe-cli.tgz" | cut -d' ' -f1)
cd - > /dev/null

# Update the formula file
sed -i.bak "s|url \".*\"|url \"$NPM_TARBALL_URL\"|" "vibe.rb"
sed -i.bak "s|sha256 \".*\"|sha256 \"$SHA256\"|" "vibe.rb"

# Clean up temp files
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✅ Formula updated with version $VERSION${NC}"
echo -e "${BLUE}📋 Formula contents:${NC}"
cat "vibe.rb"

# Commit changes
echo -e "${BLUE}💾 Committing changes...${NC}"
git add "vibe.rb"
git commit -m "Update vibe to version $VERSION"

# Push changes
echo -e "${BLUE}🚀 Pushing to GitHub...${NC}"
git push origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}🎉 Successfully published vibe to Homebrew tap!${NC}"
    echo -e "${BLUE}📋 Installation instructions:${NC}"
    echo "  brew install $TAP_REPO"
    echo ""
    echo -e "${YELLOW}📝 Note: It may take a few minutes for the changes to be available${NC}"
else
    echo -e "${RED}❌ Failed to push changes to GitHub${NC}"
    exit 1
fi

# Return to project root
cd ..

echo -e "${GREEN}✅ Homebrew publishing complete!${NC}"
