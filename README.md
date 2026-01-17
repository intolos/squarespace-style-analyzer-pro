# Website Style Analyzer Pro / Squarespace Style Analyzer Pro

## Overview

This repository contains the source code for the **Squarespace Style Analyzer Pro** and its generic counterpart, **Website Style Analyzer Pro**. The extension is designed to perform deep design audits, accessibility checks, and style consistency analysis on websites.

## 🚀 Active Project (WXT/TypeScript)

The project has been migrated to a modern development stack using the [WXT Framework](https://wxt.dev/) and TypeScript.

**The active codebase is located in the [`wxt-version/`](./wxt-version/) directory.**

### Getting Started

1. Navigate to the project folder: `cd wxt-version`
2. Install dependencies: `npm install`
3. Start development mode: `npm run dev:sqs` (or `dev:generic`)

### Build Commands

To generate the extension files for the Chrome Web Store:

- **Build Squarespace Version**: `npm run build:sqs`
- **Build Generic Version**: `npm run build:generic`
- **Zip for Web Store**: `npm run zip:sqs` or `npm run zip:generic`

## 📚 Documentation

Detailed technical logic and analysis heuristics can be found in the [**`documentation-md/`**](./documentation-md/) directory:

- [Color Analysis](./documentation-md/color-analysis.md): Pixel sampling, contrast ratios, and visibility logic.
- [Mobile Analysis](./documentation-md/mobile-analysis.md): CDP-based mobile emulation and tap-target audits.
- [Content Analysis](./documentation-md/content-analysis.md): Heuristics for headings, paragraphs, and buttons.
- [Domain Analysis](./documentation-md/domain-analysis.md): Sitemap crawling and background orchestratation.
- [Dual Extension Updates](./documentation-md/dual-extension-updates.md): Details on the WXT migration and branding strategy.

## 📂 Project Structure

- `wxt-version/`: The current, primary project folder (TypeScript/Vite/WXT).
- `legacy-extension/`: Contains the legacy version of the extension (.js files, original manifest, etc.).
- `documentation-md/`: High-level logic and architecture guides.
- `sqs-test-suite/`: Local test environment for validating analysis accuracy.
- `[Test Folders]`: Folders like `tests/`, `full-test/`, etc., are kept in the root for ongoing validation.
