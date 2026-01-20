# WXT Migration Task Tracker

## Phase 1: Project Setup

- [/] Initialize WXT project alongside existing code
- [ ] Set up project structure
- [ ] Create environment files (.env.sqs, .env.generic)
- [ ] Configure build scripts in package.json

## Phase 2: Core Configuration

- [ ] Create wxt.config.ts with manifest generation
- [ ] Create branding config (src/config/branding.ts)

## Phase 3: Platform Detection

- [ ] Create platform detector (src/platforms/index.ts)
- [ ] Create Squarespace selectors (src/platforms/squarespace/selectors.ts)
- [ ] Create generic selectors (src/platforms/generic/selectors.ts)

## Phase 4: File Migration

- [ ] Migrate content-script-helpers.js
- [ ] Migrate content-script-analyzers.js
- [ ] Migrate content-script-theme-capture.js
- [ ] Migrate color-analyzer.js
- [ ] Migrate export-\*.js files (5 files)
- [ ] Migrate domain-analyzer.js (with refactoring)
- [ ] Migrate domain-analysis-manager.js
- [ ] Migrate background.js
- [ ] Migrate popup.js + popup.html
- [ ] Migrate license-manager.js

## Phase 5: Verification

- [ ] Test Squarespace version build
- [ ] Test Generic version build
- [ ] Verify platform detection works
- [ ] Manual testing on various sites
