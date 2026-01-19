# Task: Reorder Domain Analysis UI (File Selection to Top)

- [x] Research UI structure and existing positioning logic <!-- id: 0 -->
  - [x] Locate "File Selection" section in `index.html` <!-- id: 1 -->
  - [x] Analyze `DomainAnalysisUI` and `main.ts` for visibility/ordering logic <!-- id: 2 -->
- [x] Plan the reordering and visibility fixes <!-- id: 3 -->
  - [x] Create implementation plan <!-- id: 4 -->
- [x] Implement UI changes <!-- id: 5 -->
  - [x] Modify CSS: order -1 for modal, padding-top 20px for h4 <!-- id: 6 -->
  - [x] Update `main.ts`: Hide siteInfo if results exist, show only on Reset <!-- id: 7 -->
  - [x] Update `DomainAnalysisUI.ts` & `SinglePageAnalysisUI.ts`: Remove siteInfo restoration calls <!-- id: 8 -->
- [x] Verification <!-- id: 7 -->
  - [x] Verify "File Selection" appears at the top during domain analysis <!-- id: 8 -->
- [x] Post-Verification (Golden Path) <!-- id: 9 -->
  - [x] Update architecture documentation <!-- id: 10 -->
  - [x] Add 'Why' comments and Known Issues if applicable <!-- id: 11 -->
  - [x] Archive session artifacts (YYYY-MM-DD-filename.md) <!-- id: 12 -->
  - [x] Commit, Tag, and Push <!-- id: 13 -->
