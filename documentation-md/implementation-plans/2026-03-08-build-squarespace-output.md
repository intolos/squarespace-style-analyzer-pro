# 2026-03-08 Build and Zip Squarespace Extension

## Objective
Run the build process and generate zip files EXCLUSIVELY for the Squarespace extension across all supported browsers (Chrome, Firefox, Edge). Following the user's explicit instruction, we will NOT use a `dist_zips` folder; all generated zip files will be kept in the `.output` folder (e.g., `.output/sqs/`). The zip files will be appropriately prefixed with `squarespace-` as per the `/zip` workflow principles.

## Proposed Changes

No application code changes are required. I will execute the following steps in the `wxt-version/` directory:

### 1. Build & Zip Squarespace for Chrome
```bash
npm run build:sqs
npx wxt zip --mode sqs -b chrome
# Rename the generated file in the .output folder to start with 'squarespace-'
mv .output/sqs/style-analyzer-pro-*-chrome.zip .output/sqs/squarespace-4.5.9-chrome.zip
```

### 2. Build & Zip Squarespace for Firefox
```bash
npx wxt build --mode sqs -b firefox
npx wxt zip --mode sqs -b firefox
# Rename the generated file in the .output folder to start with 'squarespace-'
mv .output/sqs/style-analyzer-pro-*-firefox.zip .output/sqs/squarespace-4.5.9-firefox.zip
```

### 3. Build & Zip Squarespace for Edge
```bash
npx wxt build --mode sqs -b edge
npx wxt zip --mode sqs -b edge
# Rename the generated file in the .output folder to start with 'squarespace-'
mv .output/sqs/style-analyzer-pro-*-edge.zip .output/sqs/squarespace-4.5.9-edge.zip
```

*Note: The version `4.5.9` will be extracted dynamically from `package.json` if run via a script, or explicitly targeted as above based on the current package version.*

## User Review Required
Please review this implementation plan and reply with **"proceed"** to execute these build, zip, and rename commands directly in the `.output` directory.
