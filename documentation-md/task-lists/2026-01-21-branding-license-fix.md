# Task List: Branding & License Fix (Archive)

- [x] Check `worker.js` for debug logging <!-- id: 0 -->
- [x] Add detailed debug logging to `worker.js` if missing <!-- id: 1 -->
- [x] Verify `edgotravel@gmail.com` status with debug logs <!-- id: 2 -->
- [x] Implement webhook metadata stamping for robust "Set and Forget" lifetime support <!-- id: 3 -->
- [x] Update `license-system.md` with full architecture details (Stripe/Worker/Webhook) <!-- id: 4 -->
- [x] Map and document all email address locations
      [x] Create `documentation-md/architecture/CONTACT_EMAIL_MAPPING.md`
      [x] List dynamic logic in `platform.ts`
      [x] List dynamic logic in `main.ts`
      [x] List static locations in welcome pages and restricted folders
- [x] Run build verification
      [x] Run `npm run build:sqs`
      [x] Run `npm run build:generic` <!-- id: 7 -->
- [x] Fix lifetime license label mismatch (shows "Yearly" instead of "Lifetime")
      [x] Swap check priority in `licenseManager.ts`
      [x] Explicitly check product IDs in `main.ts` UI logic <!-- id: 8 -->
- [x] Document license check priority logic
      [x] Update `documentation-md/architecture/license-system.md`
      [x] Add `// IMPORTANT:` comments in `licenseManager.ts` and `main.ts` <!-- id: 9 -->
- [x] Deploy and Version Release
      [x] Bump version to `v4.3.2`
      [x] Commit all changes
      [x] Resolve remote case-sensitivity duplication (`Index.html`)
      [x] Push to `origin main`
      [x] Tag and push `v4.3.2` <!-- id: 10 -->
