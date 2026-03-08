#!/bin/bash
set -e

export NODE_OPTIONS="--max-old-space-size=8192"

VERSION=$(node -p "require('./package.json').version")

echo "Building and Zipping Chrome extensions..."
rm -f .output/sqs/style-analyzer-pro-$VERSION-chrome.zip
npx wxt zip --mode sqs -b chrome

rm -f .output/generic/style-analyzer-pro-$VERSION-chrome.zip
npx wxt zip --mode generic -b chrome

rm -f .output/wp/style-analyzer-pro-$VERSION-chrome.zip
npx wxt zip --mode wp -b chrome

echo "Building and Zipping Firefox extensions..."
rm -f .output/sqs/style-analyzer-pro-$VERSION-firefox.zip
npx wxt zip --mode sqs -b firefox

rm -f .output/generic/style-analyzer-pro-$VERSION-firefox.zip
npx wxt zip --mode generic -b firefox

rm -f .output/wp/style-analyzer-pro-$VERSION-firefox.zip
npx wxt zip --mode wp -b firefox

echo "Building and Zipping Edge extensions..."
rm -f .output/sqs/style-analyzer-pro-$VERSION-edge.zip
npx wxt zip --mode sqs -b edge

rm -f .output/generic/style-analyzer-pro-$VERSION-edge.zip
npx wxt zip --mode generic -b edge

rm -f .output/wp/style-analyzer-pro-$VERSION-edge.zip
npx wxt zip --mode wp -b edge

echo "Done! Zips are in .output/<mode>/"
ls -lh .output/sqs/*.zip .output/generic/*.zip .output/wp/*.zip
