---
description: Execute a plan systematically while maintaining quality
---
# workflows:work (pi)

## Input

$ARGUMENTS

If the input above is empty, ask the user for a plan path (example: `docs/plans/2026-02-10-feat-my-feature-plan.md`) and stop.

## Goal

Implement the plan in small validated steps:
- follow existing repo conventions
- keep changes small and testable
- run tests continuously

## Workflow

### 1) Read and confirm

1. If the input looks like a file path, `read` it fully.
2. If anything is unclear, ask clarifying questions.
3. Ask for explicit user approval to start implementation.

### 2) Git setup

Use `bash` to determine branch:

```bash
current_branch=$(git branch --show-current)
default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
if [ -z "$default_branch" ]; then
  default_branch=$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo "main" || echo "master")
fi
echo "current=$current_branch default=$default_branch"
```

If on the default branch, recommend either:
- create a new feature branch, or
- use a worktree via the `git-worktree` skill (user can run `/skill:git-worktree`)

Never commit directly to the default branch without explicit user permission.

### 3) Create a todo list

Use the `compound_todo` tool to track work items. Convert the plan's implementation checklist into todos.

### 4) Execute loop

For each todo:
- read the relevant files
- implement the smallest slice
- run the most relevant tests
- mark the todo done
- if the plan file has checkboxes, update `- [ ]` to `- [x]`

### 5) Quality gate

Before declaring done:
- run the project's full test suite (as documented in the repo)
- run lint/format commands (as documented)

Optionally run parallel review agents with **compound_subagent** (only if the change is non-trivial):
- `code-simplicity-reviewer`
- `security-sentinel`
- `performance-oracle`
- language-specific reviewer (e.g. `kieran-typescript-reviewer`)

### 6) Ship

Summarize:
- what changed
- how it was tested
- any follow-ups
