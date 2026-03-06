# Development Environment Architecture

## Overview
This document describes the recommended development environment setup for the Style Analyzer Pro project.

## Node.js & npm Management
To avoid permission issues (`EACCES`), we use **nvm** (Node Version Manager) to manage Node versions.

### Key Details
- **Location**: All Node versions and global npm modules are stored in `/Users/[user]/.nvm`.
- **Default Version**: Managed by `nvm alias default`. Current target is LTS (v24.x).
- **Environment Loading**: `nvm` is loaded via the shell profile (e.g., `.zshrc`) to ensure `npm` global installs work without `sudo`.

### Critical Rules
- **DO NOT** use `sudo` for `npm install -g`. If a permission error occurs, verify `nvm` is loaded and active.
- **Node Version Transitions**: Changing Node versions via `nvm` will require re-installing global packages if they haven't been migrated using `--reinstall-packages-from`.
