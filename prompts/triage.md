---
description: Triage findings into a prioritized todo list (no coding)
---
# triage (pi)

## Input

$ARGUMENTS

If empty, ask the user to paste the findings (review notes, audit output, perf issues) and stop.

## Rules

- Do **not** implement fixes.
- Only: clarify, categorize, prioritize, and add items to the `compound_todo` tool.

## Workflow

For each finding, produce:
- Title
- Severity: P1 (critical), P2 (important), P3 (nice-to-have)
- Category
- Location (file:line) if known
- Proposed fix (1-2 sentences)

Then ask the user: Add to todo list? (yes/no/edit)

When approved, add a todo like:
- `P1 [Security] Fix ... (path:line)`

At the end:
- list all approved todos (`compound_todo` tool list)
- list skipped items
- suggest the next command: `/workflows:work` (if it’s a plan) or run `/resolve_parallel` (if it’s code TODOs)
