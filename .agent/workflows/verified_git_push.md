---
description: Commit, push, and cryptographically verify changes to remote using hash comparison
---

1. **Check Status**: Run `git status` to see what is changed.
2. **Stage Changes**: Run `git add .` (or specific files).
3. **Commit**: Run `git commit -m "Your descriptive message"`.
4. **Security Audit**: In `wxt-version/`, run `npm audit --audit-level=high` (optional but recommended before major releases).
5. **Push**: Run `git push`.
   - _If push fails due to remote changes:_
     1. Run `git pull`
     2. Resolve any conflicts
     3. Commit the resolution
     4. Run `git push` again.
6. **Get Local Hash**: Run `git rev-parse HEAD`. capture this output.
7. **Get Remote Hash**: Run `git ls-remote origin HEAD`. capture this output.
8. **VERIFICATION**: Compare the Local Hash and Remote Hash.
   - **MATCH**: Success. Notify user with "Cryptographic Proof" (show the hashes).
   - **MISMATCH**: FAILURE. Do not notify user of success. Check git status and try pushing again.
