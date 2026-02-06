---
name: smart_mem
description: Context-aware memory retrieval and storage using a curated approach.
---

# Retrieval Protocol (Optimized for Gemini)

1. Identify the core components of the user's request (e.g., "database", "auth", "css").
2. Search: Run `python3 "/Users/edmass/downloads/Squarespace Style Analyzer Pro/browser-extensions/squarespace-extension/.agent/skills/claude-mem/scripts/memory_handler.py" --search "<component>"` before proposing any solution.
3. Context Load: If relevant info is found, acknowledge it to the user and adjust your plan based on those past lessons.

# Storage Protocol (Optimized for Claude)

1. Judgment: ONLY save a memory if the solution involved:
   - Fixing a recurring bug.
   - A non-obvious configuration "gotcha."
   - A specific architectural decision made by the user.
2. Save: Run `python3 "/Users/edmass/downloads/Squarespace Style Analyzer Pro/browser-extensions/squarespace-extension/.agent/skills/claude-mem/scripts/memory_handler.py" --save "<summary>" --tags "<tags>"`
3. Pruning: If the user says a memory is wrong, use the `--delete` flag with the ID provided in search results.

# Rules

- NEVER save routine overhead or "code junk."
- ALWAYS prioritize historical "failed attempts" to prevent looping.
- Use Claude 4.5 Sonnet for summaries.
- Use Gemini 3.0 Pro for historical search.
