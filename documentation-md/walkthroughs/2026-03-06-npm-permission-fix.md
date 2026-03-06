# Walkthrough: Fixing npm EACCES Permission Issue

Date: 2026-03-06

## Problem
The user encountered `EACCES: permission denied` when trying to update `npm` globally using `npm install -g npm@11.11.0`. The existing Node/npm installation was in `/usr/local/lib/node_modules`, which was owned by `root`.

## Approaches Considered
1. **nvm (Node Version Manager)**: Recommended for long-term permission stability by installing Node in the user's home directory.
2. **chown /usr/local**: Quick fix but modifies system-wide directories.
3. **sudo npm**: Fast but persistent issue with permissions for future installs.

## Solution Implemented
Used **nvm** (Option 1).

### Steps Taken:
1. **Installation**: Ran the `nvm` install script from `nvm-sh/nvm`.
2. **Setup**: The script automatically updated `.zshrc`.
3. **Node LTS Installation**:
   - Loaded `nvm` into the current session.
   - Ran `nvm install --lts`.
   - Resulted in Node `v24.14.0`.
4. **npm Update**:
   - Ran `npm install -g npm@11.11.0`.
   - This succeeded without `sudo` because `nvm` manages Node in `~/.nvm`.

## Verification
- `node -v` output: `v24.14.0`
- `npm -v` output: `11.11.0`
- All commands succeeded without permission errors.
