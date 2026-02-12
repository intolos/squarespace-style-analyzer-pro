# Documentation Processes & Standards

**Single Source of Truth for Project Documentation**

## Core Philosophy

The goal of our documentation strategy is **Regression Prevention** and **speed of recovery**. We separate "how we got here" (history) from "how it works now" (architecture) to ensure that we can always restore the system to a working state without wading through failed attempts.

---

## 1. Documentation Structure

### `documentation-md/architecture/` (The "Golden State")

- **Purpose**: Describes the _current, working state_ of the system.
- **Content**: "Living" documents. No history of invalid attempts.
- **Key Files**:
  - `product-strategy.md`: **READ FIRST**. high-level vision and dual-build requirements.
  - `dual-build-system.md`: How the Generic vs Squarespace builds function.
  - `locate-button.md`: Critical logic for the "Locate" feature.
- **Format**: Architecture Decision Records (ADRs) and Technical Specifications.

* **Update Rule**: MUST be updated immediately after a feature is completed and verified.
* **Example Files**:
  - `popup-ui.md`: Explains every button and flow in the popup.
  - `license-system.md`: Explains exactly how the verification flow works.

### `documentation-md/walkthroughs/` (The Journey)

- **Purpose**: Preserves session history and context.
- **Content**: Step-by-step logs of what was done, what was tried, and what failed.
- **Format**: Session logs, chat dumps (summarized), debug journals.
- **Filename Convention**: `YYYY-MM-DD-[short-description].md` (e.g., `2026-01-19-license-persistence-fix.md`).
- **Update Rule**: Save these continuously as you work. Archive them here when a task is done.

### `documentation-md/implementation-plans/` (The Plan)

- **Purpose**: Detailed technical design.
- **Content**: The `implementation_plan.md` artifact from the reasoning phase.
- **Filename Convention**: `YYYY-MM-DD-[feature-description].md`.
- **Update Rule**: Archive the plan here after verification.

### `documentation-md/task-lists/` (The Plan Checklists)

- **Purpose**: Task tracking.
- **Content**: Checklists of items for specific features or bugs.
- **Filename Convention**: `YYYY-MM-DD-[short-description].md`.
- **Update Rule**: Archive your session-specific task list here upon completion.

### `documentation-md/KNOWN_ISSUES.md` (The Traps)

- **Purpose**: A list of "Gotchas" and regression traps.
- **Content**: If a bug took hours to fix, it belongs here. Explain clearly what NOT to do.

---

## 2. The "Golden Path" Workflow

1.  **Before Coding**:
    - Read the relevant file in `architecture/` to understand the _intended_ design.
    - Read `KNOWN_ISSUES.md` to avoid repeating past mistakes.

2.  **During Execution**:
    - Maintain a `walkthrough` or `task-list` to track your attempts.
    - If you find a "dead end" or a failed approach, document it in your _local_ walkthrough, but **DO NOT** put it in the architecture doc.

3.  **After Verification**:
    - **Update Architecture**: If you changed how the feature works, update the corresponding file in `architecture/`. Remove old/incorrect info.
    - **Record Traps**: If you found a subtle bug, add it to `KNOWN_ISSUES.md`.
    - **Add "Why" Comments**: If the fix was tricky (>30 mins), add `// IMPORTANT:` comments in the code explaining the rationale.
    - **Archive Session**: Move your daily task list/walkthrough to the appropriate folder using the `YYYY-MM-DD-description.md` format.
    - **Final Verification**: Confirm all documentation changes are committed and pushed from the project root.

## 3. Version Control & Code Commentary

### Git Strategy

- **Tag Liberally**: Before starting any "scary" refactor or significant change, create a tag.
  - Command: `git tag pre-license-fix-2026-01-19`
- **Tag Success**: After a fix is verified, tag it again.
  - Command: `git tag post-license-fix-2026-01-19`
- **Why**: This allows instant comparison and rollback if the new "fix" breaks something else 3 hours later.

### Git Execution Context

- **Critical**: The `documentation-md/` folder resides in the project root (`squarespace-extension/`), while code often lives in `wxt-version/`.
- **Rule**: When running `git add` or `git commit`, ALWAYS ensure you are either:
  1.  Running from the project root.
  2.  Using `git add ../documentation-md` if working from a subdirectory.
  3.  Verifying with `git status` that _all_ intended files (code + docs) are staged.

### "Why" Comments (The Anti-Regression Shield)

When you fix a tricky bug (one that took >30 mins), you MUST add a comment explaining **WHY** the code is written that way.

- **Format**: `// IMPORTANT: [Explanation of the trap]. See fix on [Date].`
- **Example**:
  ```typescript
  // IMPORTANT: Do NOT call updateUI() here - it triggers a layout shift that hides the button.
  // We tried this on 2026-01-18 and it failed. See KNOWN_ISSUES.md.
  if (!loading) return;
  ```

---

## 4. Architecture Document Template

When creating a new Architecture document (e.g. `architecture/new-feature.md`), use this structure:

```markdown
# [Feature Name] Architecture

## Overview

High-level description of what this does.

## Key Components

- `file.ts`: Responsibility
- `component.ts`: Responsibility

## Operational Logic

1.  User clicks X.
2.  System does Y.
3.  Result is Z.

## Data Flow

How data moves (Storage -> UI -> Export).

## Critical Implementation Details

- **Do Not Change**: [Mention anything brittle]
- **Dependencies**: [List external deps]
```

## 5. Automation & Compliance

All AI Agents working on this project MUST:

1.  Read this file before generating a plan.
2.  Follow the accuracy standards in `DEVELOPMENT_PRINCIPLES_CRITICAL.md` before any feature or fix.
3.  Reference `DEVELOPMENT_PRINCIPLES.md` for detailed coding standards.
4.  Check `KNOWN_ISSUES.md` before fixing bugs.
