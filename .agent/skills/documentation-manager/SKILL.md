---
name: documentation-manager
description: Handles the creation, formatting, and updating of architecture documents and walkthroughs.
---

# Documentation Manager Skill

**Purpose**: This skill provides the exact procedure for generating walkthrough logs and updating architecture documentation. It ensures precise adherence to naming conventions, formatting, and directory structures.

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
- **Content**: Step-by-step logs of EVERY attempt that was tried and why it failed. And WHY the final solution worked.
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

## 2. The "Golden Path" Workflow

1.  **Before Coding**:
    - Read the relevant file in `architecture/` to understand the _intended_ design.
    - Read `documentation-md/KNOWN_ISSUES.md` to avoid repeating past mistakes.

2.  **During Execution**:
    - Maintain a `walkthrough` to track EVERY attempt.
    - If you find a "dead end" or a failed approach, document it in your _local_ walkthrough, but **DO NOT** put it in the architecture doc.

3.  **After Verification**:
    - **Update Architecture**: If you changed how the feature works, update the corresponding file in `architecture/`. Remove old/incorrect info.
    - **Record Traps**: If you found a subtle bug, add it to `KNOWN_ISSUES.md`.
    - **Add "Why" Comments**: If the fix was tricky (>2 attempts), add `// IMPORTANT:` comments in the code explaining the rationale.
    - **Archive Session**: Move your daily task list/walkthrough to the appropriate folder using the `YYYY-MM-DD-description.md` format.
    - **Final Verification**: Confirm all documentation changes are committed and pushed from the project root.

## 3. Architecture Document Template

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
