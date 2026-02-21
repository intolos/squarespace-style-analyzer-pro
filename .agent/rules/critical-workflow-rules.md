---
trigger: always_on
---

CRITICAL WORKFLOW RULES:

1. **Planning mode**: When in Planning, never take action to make any changes, except to create plan documents such as Implementation Plan and Task Lists and Handovers and Walkthroughs and Architecture and related documentation, until I specifically state "proceed". Specifically, no tools that modify, browse, or execute until I give permission by explicitly stating "proceed". This is absolute.
   - **MANDATORY**: Before calling ANY tool (search, list, read, run, etc.), you MUST verify if the current Mode is PLANNING.
   - **IF MODE IS PLANNING**: You are HARD-BLOCKED from using any tool except `view_file` or `write_to_file` (for docs). Any violation is a CRITICAL FAILURE of the task.
   - You will report your state to the user at the start of each new chat and if in Planning mode, you will state "Current Mode: PLANNING (Status: Tools Locked)" and stay in that mode until the user changes to a specific execution mode.
2. **NO BANDAID FIXES**: Always refactor for quality. Never duplicate logic across files (e.g., duplicated filters in multiple entry points). If a quick fix is required, it must be immediately followed by a refactor plan (Handover Document) and clearly flagged as technical debt.
3. **Total Scope Control & Explicit Approval**: Limit all execution to the explicit requirements of the USER. If you identify any additional improvements—whether they are logic refactors, design enhancements, architectural changes, or syncing fixes to related files—you must document these as "Proposed Suggestions" in the `implementation_plan.md`. You MUST not begin execution (writing code, syncing files, or running deployment commands) until the USER has reviewed the plan and given a clear "Proceed."
4. Before writing code, you MUST read "documentation-md/DOCUMENTATION_PROCESSES.md" to understand where to look for architecture vs. history, then "documentation-md/DEVELOPMENT_PRINCIPLES_CRITICAL.md" for accuracy standards and the pre-implementation checklist.
5. Check "documentation-md/KNOWN_ISSUES.md" before fixing bugs to avoid regression traps.
6. If you fix a bug or add a feature, you MUST update the relevant file in "documentation-md/architecture/" to reflect the new working state.
7. Always add "// IMPORTANT:" comments explaining "WHY" for tricky logic to prevent regressions.
8. **Variable-Based Worker Architecture**: The Cloudflare Worker (`cloudflare/worker.js`) MUST use ONLY variables for Product IDs and Price IDs. It must NEVER contain hardcoded Product/Price ID strings. The ONLY file allowed to have hardcoded IDs is `wxt-version/src/utils/platform.ts`. The worker receives IDs from the client request and returns metadata flags (`is_lifetime`, `is_yearly`) for the client to use for UI decisions.
9. **Legacy Extension Preservation**: NEVER modify any files within the `legacy-extension/` directory. This directory is strictly for historical reference and must remain untouched by AI agents. All changes must be applied to the `wxt-version/` directory or other modern components.
10. **Critical: Debugging Methodology **: When debugging complex, persistent issues (especially DOM-related locate/highlight features), follow this strict process:

- **Analyze first, code second.** No guessing at fixes.
- **One small change at a time.** Every fix must be isolated and testable.
- **Test and verify** before proceeding to the next change.
- **Roll back immediately** if something breaks — do not pile on more changes.
- **Log every attempt** in the relevant handover document with PASS/FAIL/PARTIAL results.

11. **Single Responsibility Principle (SRP)**: Each file MUST have ONE clear responsibility. If a file handles multiple concerns, split it. Files exceeding 500 lines require evaluation; files exceeding 700 lines MUST be refactored.
12. **DRY (Don't Repeat Yourself)**: Never duplicate logic across files. Extract repeated patterns into shared utilities. If you find yourself copying code, STOP and refactor first.
