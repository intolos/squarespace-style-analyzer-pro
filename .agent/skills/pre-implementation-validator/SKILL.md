---
name: pre-implementation-validator
description: Handles the mandatory pre-flight checks, known issue reviews, and architectural validation before writing code.
---

# Pre-Implementation Validator Skill

**Purpose**: This skill ensures that before ANY code changes are made, the necessary architectural review, issue verification, and planning checklists have been executed perfectly to prevent regressions.

## 1. Mandatory Planning and Pre-Implementation Checklist

### Before Writing ANY Code, Answer These Questions and follow this first command:

- [ ] **MANDATORY**: I have read `documentation-md/DOCUMENTATION_PROCESSES.md` and understand where to look for architecture vs. history.

- [ ] I will not change items that are working properly. I will not change items that are not working differently than requested.

- [ ] Have I researched how industry-standard tools (WAVE, Lighthouse, axe) implement this?

- [ ] Am I using the MOST accurate method available, not just the easiest?

- [ ] Does this follow SRP? (One file, one responsibility)

- [ ] Have I identified what tests I'll run to validate accuracy?

- [ ] Have I tested against multiple real-world websites?

- [ ] Have I compared my results against established tools?

- [ ] Have I handled all edge cases I can think of?

- [ ] Have I documented my approach and why it's the most accurate?

- [ ] Have I documented any known limitations?

- [ ] Am I following all coding standards? (naming, error handling, documentation)

- [ ] Would I trust these results if I were the user?

- [ ] Have I asked questions to clarify product requirements, technical requirements, engineering principles, and hard constraints?

## 2. Before Writing ANY Fix:

1. **REPRODUCE & OBSERVE**
   - [ ] Can I see the broken behavior myself?
   - [ ] What does the ACTUAL output look like (HTML/DOM/console)?
   - [ ] How does it differ from EXPECTED output?

2. **COMPARE WORKING VS BROKEN**
   - [ ] Is there a working example I can compare against?
   - [ ] What is DIFFERENT between working and broken?
   - [ ] Have I read the actual generated output, not just the source?

3. **DIAGNOSE BEFORE FIXING**
   - [ ] Do I know the ROOT CAUSE, or am I guessing?
   - [ ] Can I explain WHY the bug happens?
   - [ ] Have I verified my diagnosis by reading the actual output?

**IF YOU CANNOT CHECK ALL BOXES: STOP. ASK FOR OUTPUT/EXAMPLES.**

Never implement a fix based on assumptions. Always diagnose first. Never blame the user for not properly generating a new report. Never say that Chrome caches data.

## If You Cannot Check ALL Boxes: STOP

Ask for guidance before proceeding. Never make assumptions.
