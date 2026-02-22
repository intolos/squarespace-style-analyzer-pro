# AGENTS.md - Agentic Coding Guidelines

Guidelines for AI agents working on the Style Analyzer Pro browser extension.

## Project Overview

Browser extension for professional website design audits. Built with WXT framework, TypeScript, and Vitest. Supports three build modes: Squarespace (sqs), WordPress (wp), and Generic (generic).

## Build Commands

```bash
# Development (all modes)
cd wxt-version && npm run dev:sqs      # Squarespace mode
cd wxt-version && npm run dev:wp       # WordPress mode
cd wxt-version && npm run dev:generic  # Generic mode

# Build (all modes)
cd wxt-version && npm run build:sqs
cd wxt-version && npm run build:wp
cd wxt-version && npm run build:generic

# Create distribution zips
cd wxt-version && npm run zip:sqs
cd wxt-version && npm run zip:wp
cd wxt-version && npm run zip:generic

# Type checking
cd wxt-version && npm run compile
```

## Test Commands

```bash
# Run all unit tests
cd wxt-version && npm run test:logic

# Run single test file
cd wxt-version && npx vitest run tests/unit/logic/colorLogic.test.ts

# Run tests matching pattern
cd wxt-version && npx vitest run --testNamePattern="contrast"

# Run tests in watch mode
cd wxt-version && npx vitest

# E2E tests with Playwright
cd wxt-version && npm run test:e2e
```

## Code Style Guidelines

### TypeScript

- Strict mode enabled
- ESNext module system
- Use type imports: `import type { Foo } from './types'`
- Always define return types for exported functions

### Naming Conventions

- **Files**: kebab-case (e.g., `color-analyzer.ts`)
- **Functions**: verbNoun (e.g., `getBackgroundColor`, `calculateContrastRatio`)
- **Variables**: Descriptive nouns (e.g., `effectiveBackground`, `contrastRatio`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Booleans**: `isTransparent`, `hasDirectText`, `shouldTrackColor`
- No single-letter variables except loop counters (i, j)
- No abbreviations (use `background` not `bg`, `element` not `el`)

### Imports

```typescript
// External dependencies first
import { defineConfig } from 'wxt';

// Internal absolute imports
import { isSqs } from '@/utils/platform';

// Internal relative imports
import { calculateContrastRatio } from '../utils/colorUtils';

// Type imports
import type { AnalysisResult } from '../types';
```

### Error Handling

- Never fail silently - always log errors or warnings
- Use try-catch for operations that can fail (canvas, DOM access)
- Provide fallbacks with warnings when primary method fails
- Validate inputs at function boundaries

```typescript
// GOOD
function getBackground(element: Element): string | null {
  try {
    return getBackgroundFromCanvas(element);
  } catch (e) {
    console.warn('Canvas background detection failed, using DOM fallback:', e);
    return getBackgroundFromDOM(element);
  }
}
```

### Comments

- Comments explain WHY, not WHAT
- Use `// IMPORTANT:` comments for tricky logic that took >30 mins to fix
- Include test validation notes for accuracy-critical code

```typescript
// IMPORTANT: Do NOT call updateUI() here - it triggers layout shift.
// We tried this on 2026-01-18 and it failed. See KNOWN_ISSUES.md.

/**
 * Get effective background color using canvas pixel sampling.
 * Handles background images, gradients, overlapping elements.
 * @returns RGB/RGBA color string, or null if detection fails
 * Why canvas: Most accurate method, matches WAVE tool behavior.
 * Fallback: DOM tree walking if canvas fails.
 */
```

### File Organization (SRP)

- Each file has ONE clear responsibility
- If a file exceeds 500 lines, evaluate splitting
- If a file exceeds 700 lines, MUST refactor into smaller modules
- Name files descriptively by their single purpose

### No Magic Numbers

```typescript
// BAD
if (fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700))
  // GOOD
  const LARGE_TEXT_SIZE = 18;
const LARGE_TEXT_BOLD_SIZE = 14;
const BOLD_WEIGHT_THRESHOLD = 700;
```

## Critical Rules

### Variable-Based Worker Architecture

- Cloudflare Worker (`cloudflare/worker.js`) MUST use ONLY variables for Product IDs and Price IDs
- NEVER hardcode Product/Price ID strings in the worker
- ONLY file allowed to have hardcoded IDs: `wxt-version/src/utils/platform.ts`
- Worker receives IDs from client request and returns metadata flags

### Legacy Extension Preservation

- NEVER modify files in `legacy-extension/` directory
- This directory is strictly for historical reference
- All changes must be applied to `wxt-version/` directory

### Documentation Requirements

Before implementing ANY feature or fix or code change or any analysis to troubleshoot a problem or error or anything that is not working correctly:

1. Always, this means always, read `.agent/rules/critical-workflow-rules.md`

### Accuracy Standards

- Accuracy is NON-NEGOTIABLE - priority over performance and convenience
- Use the most accurate method available (canvas rendering, pixel sampling)
- Validate against industry tools (WAVE, Lighthouse, Chrome DevTools)
- Fail loudly with warnings, never silently
- Document test results with actual vs expected values

### Testing Standards

- Compare against industry tools (WAVE, Lighthouse, Chrome DevTools)
- Test on real websites, not toy examples
- Test edge cases (transparent backgrounds, overlapping elements, etc.)
- Document test validation in code comments

## Project Structure

```
wxt-version/
├── entrypoints/          # Extension entry points
│   ├── background.ts     # Service worker
│   ├── content.ts        # Content script
│   └── popup/            # Popup UI
├── src/
│   ├── analyzers/        # Analysis modules (colors, typography, etc.)
│   ├── platforms/        # Platform-specific logic (sqs, wp, generic)
│   ├── managers/         # State managers (license, results)
│   ├── ui/               # UI components
│   ├── export/           # Report generation
│   └── utils/            # Utility functions
├── tests/
│   ├── unit/logic/       # Unit tests
│   └── e2e/              # Playwright E2E tests
└── public-{sqs,wp,generic}/  # Mode-specific assets
```

## Mode-Specific Builds

Three build modes with different configurations:

- **Squarespace (sqs)**: Squarespace-specific checks and branding
- **WordPress (wp)**: WordPress-specific checks and branding
- **Generic (generic)**: Universal website checks

Mode detection uses `import.meta.env.VITE_IS_SQS_VERSION` and `import.meta.env.VITE_IS_WP_VERSION`.
Only `src/utils/platform.ts` contains hardcoded mode-specific values (Stripe IDs, URLs).

## Git Workflow

```bash
# Tag before scary refactors
git tag pre-feature-name-YYYY-MM-DD

# Tag after verified fixes
git tag post-feature-name-YYYY-MM-DD

# Documentation is in project root
git add documentation-md/  # From wxt-version/, use ../documentation-md
git add wxt-version/src/   # Code changes
```

"rules": {
"documentation-creation": {
"description": "File creation protocol for planning documents",
"trigger": "When creating implementation plans or task lists",
"actions": [
"Create actual files in appropriate folders",
"Use naming format: YYYY-MM-DD-[description].md",
"Place implementation plans in: documentation-md/implementation-plans/",
"Place task lists in: documentation-md/task-lists/",
"Do NOT display full text of these documents in chat",
"Reference them by filename only when discussing",
"Read them silently when necessary without displaying contents"
]
}
}
