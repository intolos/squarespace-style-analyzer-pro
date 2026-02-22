---
name: state-manager
description: Standardized processes for checkpointing code state via git tags to prevent regressions.
---

# State Manager Skill

**Purpose**: Checkpoint the code state safely before and after doing meaningful refactors or bug fixes. If something goes wrong, we can instantly rollback without complex `git reflog` archaeology.

## 1. Version Control & Code Commentary

### Git Strategy

- **Tag Liberally**: Before starting any "scary" refactor or significant change, create a tag.
  - Command: `git tag pre-feature_name-YYYY-MM-DD` (e.g. `git tag pre-license-fix-2026-01-19`)
- **Tag Success**: After a fix is verified, tag it again.
  - Command: `git tag post-feature_name-YYYY-MM-DD` (e.g. `git tag post-license-fix-2026-01-19`)
- **Why**: This allows instant comparison and rollback if the new "fix" breaks something else 3 hours later.

### Git Execution Context

- **Critical**: The `documentation-md/` folder resides in the project root (`squarespace-extension/`), while code often lives in `wxt-version/`.
- **Rule**: When running `git add` or `git commit`, ALWAYS ensure you are either:
  1.  Running from the project root.
  2.  Using `git add ../documentation-md` if working from a subdirectory.
  3.  Verifying with `git status` that _all_ intended files (code + docs) are staged.
