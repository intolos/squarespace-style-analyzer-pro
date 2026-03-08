---
description: Create zip files for squarespace, generic, and wp for chrome, edge, and firefox. Start each zip file with the "squarespace-", "website-" for the generic version, and "wp-" as appropriate for the zip file created.
---

# Zip All Extensions Workflow

This workflow automatically builds and zips all extensions (Squarespace, Generic, WordPress) for all supported browsers (Chrome, Firefox, Edge). It relies on the optimized `./build-and-zip.sh` script which cleans build directories between runs to prevent Out-Of-Memory errors caused by exponential zip nesting.

1. Give the script execution permissions if needed.
// turbo-all
2. Execute the script from the wxt-version directory:
```bash
cd wxt-version
chmod +x build-and-zip.sh
./build-and-zip.sh
```
