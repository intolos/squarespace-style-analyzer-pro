---
description: How to maintain documentation consistency and prevent regressions
---

# Documentation Workflow

This workflow triggers when you are asked to write documentation, fix bugs, or add features.

## 1. Pre-Work Check

Before starting any code changes:

- [ ] Read `documentation-md/DOCUMENTATION_PROCESSES.md` to refresh on the folder structure.
- [ ] Read `documentation-md/KNOWN_ISSUES.md` (if it exists) to verify you aren't walking into a known trap.
- [ ] Check `documentation-md/architecture/` for existing docs on the component you are modifying.

## 2. During Work (Walkthroughs)

- [ ] Keep a running log of your actions in a `documentation-md/walkthroughs/session-[date]-[topic].md` file OR primarily use the `walkthrough.md` artifact if in Agentic Mode.
- [ ] **Crucial**: If you try a fix and it fails, document WHY it failed in your walkthrough/log.
- [ ] **Critical: Debugging Methodology **: When debugging complex, persistent issues (especially DOM-related locate/highlight features), follow this strict process:
  - **Analyze first, code second.** No guessing at fixes.
  - **One small change at a time.** Every fix must be isolated and testable.
  - **Test and verify** before proceeding to the next change.
  - **Roll back immediately** if something breaks — do not pile on more changes.
  - **Log every attempt** in the relevant handover document with PASS/FAIL/PARTIAL results.

## 3. Post-Work (Architecture Updates)

After your code is verified working:

- [ ] **Update Architecture**: Does your change affect how a feature works?
  - **YES**: specific file in `documentation-md/architecture/` MUST be updated to reflect the _new_ reality. Remove old descriptions.
  - **NO**: Skip.

- [ ] **Record "Gotchas"**: Did you encounter a regression or a non-obvious failure mode?
  - **YES**: Add it to `documentation-md/KNOWN_ISSUES.md`.
  - **NO**: Skip.

- [ ] **Archive**: Ensure your session log/walkthrough is saved in `documentation-md/walkthroughs/`.

## Summary of Folders

- `architecture/`: **TRUTH**. How it works NOW.
- `walkthroughs/`: **HISTORY**. How we got here.
- `KNOWN_ISSUES.md`: **WARNINGS**. What strictly NOT to do.
