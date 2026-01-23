// KEEP Historical Comparison - Squarespace Button Deduplication by Section-Block
//
// This is the ORIGINAL button deduplication logic that was replaced with dimension-based
// position deduplication. Preserved for historical comparison and potential rollback.
//
// Original approach: Deduplicate by text + Squarespace section + Squarespace block
//
// Why it was replaced:
// - On generic (non-Squarespace) sites, section/block = "N/A"
// - This caused intentional button repetitions to be treated as duplicates
// - Example: 4 "Add to Chrome" buttons at different positions = counted as 1
//
// New approach: Deduplicate by text + rounded position (see buttons.ts lines 123-130)
//
// Date replaced: 2026-01-23
// Replaced in: src/analyzers/buttons.ts

// Original deduplication code (lines 123-124):
const buttonKey = text + '|' + section + '|' + block;
if (processedButtonKeys.has(buttonKey)) continue;
processedButtonKeys.add(buttonKey);

// Where this was used:
// - After filtering excluded patterns
// - Before checking button validity (hasHref, isButton, etc.)
// - Prevented same button text in same section/block from being counted twice
//
// Worked well for Squarespace sites because:
// - Squarespace framework duplicates buttons within same section/block
// - Section/block IDs provided meaningful grouping
// - Caught framework duplicates effectively
//
// Failed for generic sites because:
// - No meaningful section/block structure
// - All buttons got section="N/A", block="N/A"
// - Intentional repetitions were incorrectly deduplicated
