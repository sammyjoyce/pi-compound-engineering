---
description: Document solved problems to compound team knowledge
---
# workflows:compound (pi)

## What did we learn?

$ARGUMENTS

If empty, ask the user: "What problem did we solve, and what should we capture for next time?" and stop.

## Goal

Turn a solved problem into a reusable solution note.

## Workflow

1. Ask for any missing context:
   - symptoms / error messages
   - root cause
   - fix
   - how to detect/regress-test

2. Choose a category (create directories as needed):
   - `docs/solutions/debugging-patterns/`
   - `docs/solutions/performance-issues/`
   - `docs/solutions/configuration-fixes/`
   - `docs/solutions/integration-issues/`
   - `docs/solutions/deployment-issues/`

3. Write a solution note:

```markdown
---
title: "..."
category: ...
tags: [ ... ]
date: YYYY-MM-DD
---

# ...

## Symptom

## Root cause

## Fix

## Verification

## Gotchas / Follow-ups
```

Use a descriptive filename like:
- `docs/solutions/<category>/2026-02-10-<short-slug>.md`

4. Ask the user whether to link this note from the related plan/issue/PR.
