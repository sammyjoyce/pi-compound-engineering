---
description: Run a comprehensive review pass using bundled reviewer agents
---
# workflows:review (pi)

## What to review

$ARGUMENTS

If empty, ask the user what to review (e.g., "staged changes", a branch name, or a PR URL) and stop.

## Workflow

### 1) Gather review context

Prefer evidence over guesses:
- If this is a git repo, collect diffs and test output.
- If reviewing staged changes: `git diff --cached`
- If reviewing working tree: `git diff`

### 2) Run reviewer agents in parallel

Use **compound_subagent** in parallel. Pick the smallest set that matches the stack:

Core reviewers (usually useful):
- `code-simplicity-reviewer`
- `security-sentinel`
- `performance-oracle`

Stack-specific (only if relevant):
- Rails: `dhh-rails-reviewer`, `kieran-rails-reviewer`
- TypeScript: `kieran-typescript-reviewer`
- Python: `kieran-python-reviewer`

For each agent task:
- Tell it what to review
- Tell it how to get the diff (`git diff ...`) and where to focus

### 3) Synthesize

Return a single review with:
- **High risk issues** (must fix)
- **Medium** (should fix)
- **Low / nits**
- **Suggested tests to run**

If issues are fixable quickly, propose a patch plan. Do not implement fixes unless asked.
