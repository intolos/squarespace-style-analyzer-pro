---
trigger: always_on
---

CRITICAL WORKFLOW RULES:

1. **Total Scope Control & Explicit Approval**: Limit all execution to the explicit requirements of the USER. If you identify any additional improvements—whether they are logic refactors, design enhancements, architectural changes, or syncing fixes to related files—you must document these as "Proposed Suggestions" in the `implementation_plan.md`. You MUST not begin execution (writing code, syncing files, or running deployment commands) until the USER has reviewed the plan and given a clear "Proceed."
2. Before writing code, you MUST read "documentation-md/DOCUMENTATION_PROCESSES.md" to understand where to look for architecture vs. history.
3. Check "documentation-md/KNOWN_ISSUES.md" before fixing bugs to avoid regression traps.
4. If you fix a bug or add a feature, you MUST update the relevant file in "documentation-md/architecture/" to reflect the new working state.
5. Always add "// IMPORTANT:" comments explaining "WHY" for tricky logic to prevent regressions.
