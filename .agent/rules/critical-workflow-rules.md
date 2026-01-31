---
trigger: always_on
---

CRITICAL WORKFLOW RULES:

1. **NO BANDAID FIXES**: Always refactor for quality. Never duplicate logic across files (e.g., duplicated filters in multiple entry points). If a quick fix is required, it must be immediately followed by a refactor plan (Handover Document) and clearly flagged as technical debt.
2. **Total Scope Control & Explicit Approval**: Limit all execution to the explicit requirements of the USER. If you identify any additional improvements—whether they are logic refactors, design enhancements, architectural changes, or syncing fixes to related files—you must document these as "Proposed Suggestions" in the `implementation_plan.md`. You MUST not begin execution (writing code, syncing files, or running deployment commands) until the USER has reviewed the plan and given a clear "Proceed."
3. Before writing code, you MUST read "documentation-md/DOCUMENTATION_PROCESSES.md" to understand where to look for architecture vs. history.
4. Check "documentation-md/KNOWN_ISSUES.md" before fixing bugs to avoid regression traps.
5. If you fix a bug or add a feature, you MUST update the relevant file in "documentation-md/architecture/" to reflect the new working state.
6. Always add "// IMPORTANT:" comments explaining "WHY" for tricky logic to prevent regressions.
7. **Variable-Based Worker Architecture**: The Cloudflare Worker (`cloudflare/worker.js`) MUST use ONLY variables for Product IDs and Price IDs. It must NEVER contain hardcoded Product/Price ID strings. The ONLY file allowed to have hardcoded IDs is `wxt-version/src/utils/platform.ts`. The worker receives IDs from the client request and returns metadata flags (`is_lifetime`, `is_yearly`) for the client to use for UI decisions.
8. **Legacy Extension Preservation**: NEVER modify any files within the `legacy-extension/` directory. This directory is strictly for historical reference and must remain untouched by AI agents. All changes must be applied to the `wxt-version/` directory or other modern components.
