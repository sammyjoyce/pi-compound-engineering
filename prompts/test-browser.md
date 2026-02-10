---
description: Run lightweight browser checks using agent-browser CLI
---
# test-browser (pi)

## Scope

$ARGUMENTS

If empty, assume "current branch".

## Prereqs

- A dev server is running (user provides URL, default: http://localhost:3000)
- `agent-browser` CLI installed

If `agent-browser` is not installed, load the `agent-browser` skill (or instruct the user to run `/skill:agent-browser`).

## Workflow

1. Determine changed files (if in a git repo):
   - current branch: `git diff --name-only origin/main...HEAD` (or your default branch)
2. Ask the user which routes/pages are affected (mapping code to routes is app-specific).
3. For each route:
   - `agent-browser open <url>`
   - `agent-browser snapshot -i`
   - click through primary interactions
   - take screenshots on failures
4. Report:
   - pages tested
   - any console errors observed
   - failures + repro steps
   - suggested next actions (fix now vs add todo)
