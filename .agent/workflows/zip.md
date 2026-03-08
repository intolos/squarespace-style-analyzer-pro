---
description: Create zip files for squarespace, generic, and wp for chrome, edge, and firefox. Start each zip file with the "squarespace-", "website-" for the generic version, and "wp-" as appropriate for the zip file created.
---

# Zip All Extensions Workflow

This workflow builds and zips all extensions (Squarespace, Generic, WordPress) for all supported browsers (Chrome, Firefox, Edge). Zips are placed by WXT directly into `.output/<mode>/`.

## How it works

- Before each build, only the specific target zip file is deleted (e.g. `.output/sqs/style-analyzer-pro-<version>-chrome.zip`)
- The rest of `.output/<mode>/` is left intact so builds for other browsers are preserved
- This prevents the "zip-inception" OOM crash caused by WXT trying to zip previously created zip files

## Usage

// turbo-all
```bash
cd wxt-version
chmod +x build-and-zip.sh
./build-and-zip.sh
```

Zips will be in:
- `.output/sqs/style-analyzer-pro-<version>-<browser>.zip`
- `.output/generic/style-analyzer-pro-<version>-<browser>.zip`
- `.output/wp/style-analyzer-pro-<version>-<browser>.zip`
