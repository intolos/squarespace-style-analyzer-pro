#!/bin/bash

# Automated test runner for Squarespace Style Analyzer Pro
# This script installs dependencies and runs the automated tests

cd "$(dirname "$0")"

echo "🔧 Setting up automated tests..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing test dependencies (puppeteer)..."
    npm install
    echo ""
fi

echo "🚀 Running automated color tracking tests..."
echo ""

node test-color-tracking.js

echo ""
echo "✅ Tests complete!"
