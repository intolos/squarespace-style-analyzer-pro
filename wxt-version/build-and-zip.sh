#!/bin/bash
set -e

export NODE_OPTIONS="--max-old-space-size=8192"

VERSION=$(node -p "require('./package.json').version")
OUTPUT_DIR="dist-zips"
mkdir -p "$OUTPUT_DIR"

# Clean old zips
rm -f "$OUTPUT_DIR"/*.zip

echo "Building and Zipping Chrome extensions..."
rm -rf .output/sqs
npx wxt zip --mode sqs -b chrome
cp .output/sqs/style-analyzer-pro-$VERSION-chrome.zip "$OUTPUT_DIR/squarespace-$VERSION-chrome.zip"

rm -rf .output/generic
npx wxt zip --mode generic -b chrome
cp .output/generic/style-analyzer-pro-$VERSION-chrome.zip "$OUTPUT_DIR/website-$VERSION-chrome.zip"

rm -rf .output/wp
npx wxt zip --mode wp -b chrome
cp .output/wp/style-analyzer-pro-$VERSION-chrome.zip "$OUTPUT_DIR/wp-$VERSION-chrome.zip"

echo "Building and Zipping Firefox extensions..."
rm -rf .output/sqs
npx wxt zip --mode sqs -b firefox
cp .output/sqs/style-analyzer-pro-$VERSION-firefox.zip "$OUTPUT_DIR/squarespace-$VERSION-firefox.zip"

rm -rf .output/generic
npx wxt zip --mode generic -b firefox
cp .output/generic/style-analyzer-pro-$VERSION-firefox.zip "$OUTPUT_DIR/website-$VERSION-firefox.zip"

rm -rf .output/wp
npx wxt zip --mode wp -b firefox
cp .output/wp/style-analyzer-pro-$VERSION-firefox.zip "$OUTPUT_DIR/wp-$VERSION-firefox.zip"

echo "Building and Zipping Edge extensions..."
rm -rf .output/sqs
npx wxt zip --mode sqs -b edge
cp .output/sqs/style-analyzer-pro-$VERSION-edge.zip "$OUTPUT_DIR/squarespace-$VERSION-edge.zip"

rm -rf .output/generic
npx wxt zip --mode generic -b edge
cp .output/generic/style-analyzer-pro-$VERSION-edge.zip "$OUTPUT_DIR/website-$VERSION-edge.zip"

rm -rf .output/wp
npx wxt zip --mode wp -b edge
cp .output/wp/style-analyzer-pro-$VERSION-edge.zip "$OUTPUT_DIR/wp-$VERSION-edge.zip"

echo "All extensions built and zipped successfully in $OUTPUT_DIR/"
ls -lh "$OUTPUT_DIR"
