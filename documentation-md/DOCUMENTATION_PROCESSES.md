# Documentation Processes & Standards

**Single Source of Truth for Project Documentation**

## Core Philosophy

The goal of our documentation strategy is **Regression Prevention** and **speed of recovery**. We separate "how we got here" (history) from "how it works now" (architecture) to ensure that we can always restore the system to a working state without wading through failed attempts.

---

## 1. Documentation Execution & Enforcement

All documentation creation, formatting, archiving, and git tagging MUST be handled exclusively by invoking the corresponding AI skills. Do not manually format or manage these processes.

### Required Skills:

1. **`documentation-manager`**: Located at `.agent/skills/documentation-manager/SKILL.md`. This skill dictates the exact templates, structures (e.g., `documentation-md/architecture/` vs `documentation-md/walkthroughs/`), and filename conventions required when documenting features and fixes.
2. **`state-manager`**: Located at `.agent/skills/state-manager/SKILL.md`. This skill dictates the git tagging and context management protocols necessary to safeguard code state.

When a rule dictates that documentation or state checkpointing is necessary, you must invoke the skills above.

## 2. Automation & Compliance

All AI Agents working on this project MUST:

1.  Read this file to understand the overarching documentation philosophy.
2.  Follow the accuracy standards in `documentation-md/DEVELOPMENT_PRINCIPLES_CRITICAL.md` and use the `pre-implementation-validator` skill before any feature or fix.
3.  Reference `documentation-md/DEVELOPMENT_PRINCIPLES.md` for detailed coding standards.
4.  Check `documentation-md/KNOWN_ISSUES.md` before fixing bugs to avoid regression traps.
