---
trigger: always_on
---

CRITICAL WORKFLOW RULES:

1. Before writing code, you MUST read "documentation-md/DOCUMENTATION_PROCESSES.md" to understand where to look for architecture vs. history.
2. Check "documentation-md/KNOWN_ISSUES.md" before fixing bugs to avoid regression traps.
3. If you fix a bug or add a feature, you MUST update the relevant file in "documentation-md/architecture/" to reflect the new working state.
4. Always add "// IMPORTANT:" comments explaining "WHY" for tricky logic to prevent regressions.
