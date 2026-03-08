# 2026-03-08 Build and Zip All Extensions

## Objective
Run builds for all extensions (Squarespace, Generic, WordPress) for all supported browsers (Chrome, Firefox, Edge) and package them into zip files.

## Proposed Changes
No code changes are required. I will execute the following commands in the `wxt-version/` directory:

### 1. Build & Zip Chrome (Default)
```bash
npm run build:sqs
npm run build:generic
npm run build:wp
npm run zip:sqs
npm run zip:generic
npm run zip:wp
```

### 2. Build & Zip Firefox
```bash
npx wxt build --mode sqs -b firefox
npx wxt build --mode generic -b firefox
npx wxt build --mode wp -b firefox
npx wxt zip --mode sqs -b firefox
npx wxt zip --mode generic -b firefox
npx wxt zip --mode wp -b firefox
```

### 3. Build & Zip Edge
```bash
npx wxt build --mode sqs -b edge
npx wxt build --mode generic -b edge
npx wxt build --mode wp -b edge
npx wxt zip --mode sqs -b edge
npx wxt zip --mode generic -b edge
npx wxt zip --mode wp -b edge
```

## User Review Required
Please review this implementation plan and reply with **"proceed"** to execute these build and zip commands.
