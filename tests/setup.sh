#!/bin/bash

# Playwright Test Setup Script
# This script installs Playwright and sets up the test environment

set -e

echo "🎭 Setting up Playwright for Cozyberries Admin..."
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install

# Install system dependencies for browsers (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Installing system dependencies for Linux..."
    npx playwright install-deps
fi

# Check if .env.test exists
if [ ! -f ".env.test" ]; then
    echo "⚠️  .env.test file not found!"
    echo "📝 Creating .env.test from .env.test.example..."
    
    if [ -f ".env.test.example" ]; then
        cp .env.test.example .env.test
        echo "✅ .env.test created. Please update it with your test credentials."
    else
        echo "❌ .env.test.example not found. Please create .env.test manually."
    fi
else
    echo "✅ .env.test file already exists."
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update .env.test with your test credentials (if not already done)"
echo "  2. Start the dev server: npm run dev"
echo "  3. Run tests: npm test"
echo ""
echo "Available test commands:"
echo "  npm test              - Run all tests (headless)"
echo "  npm run test:ui       - Run tests with UI mode"
echo "  npm run test:headed   - Run tests in headed mode"
echo "  npm run test:debug    - Run tests in debug mode"
echo "  npm run test:report   - Show test report"
echo ""
