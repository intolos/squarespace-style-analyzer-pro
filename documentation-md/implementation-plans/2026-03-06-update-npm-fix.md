# Implementation Plan - Fix npm Permission Issue (EACCES)

The user is encountering `EACCES` errors when trying to update `npm` globally. This is due to the current installation requiring root permissions for the `/usr/local/lib/node_modules` directory.

## Proposed Solutions

### 1. Use Node Version Manager (nvm) [RECOMMENDED]
This avoids permission issues entirely by installing Node and npm in the user's home directory.
**Steps:**
1. Install nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`
2. Restart terminal.
3. Install node: `nvm install --lts`
4. Use the new node: `nvm use --lts`

### 2. Change Ownership of npm Directory
If the user prefers to keep the current installation, we can change the ownership of the `/usr/local` subdirectories to the current user.
**Command:**
`sudo chown -R $(whoami) /usr/local/lib/node_modules /usr/local/bin /usr/local/share`

### 3. Quick Fix (Sudo)
Updating using `sudo npm install -g npm@11.11.0`. 
**Command:**
`sudo npm install -g npm@11.11.0`
*Note: This may require sudo for future global installs.*

## Verification Plan
1. Ask the user to run `npm -v` after applying a fix to confirm successful update to `11.11.0`.
