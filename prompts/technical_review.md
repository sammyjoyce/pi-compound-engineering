---
description: Have multiple specialized agents review a plan in parallel
---
# technical_review (pi)

## Input

$ARGUMENTS

If empty, ask for a plan path (or paste the plan) and stop.

## Workflow

1. If the input is a file path, `read` it.
2. Use **compound_subagent** in parallel to review the technical approach.

Recommended default set:
- `architecture-strategist`
- `security-sentinel`
- `performance-oracle`
- `code-simplicity-reviewer`

If Rails: add `dhh-rails-reviewer`, `kieran-rails-reviewer`.
If TypeScript: add `kieran-typescript-reviewer`.
If Python: add `kieran-python-reviewer`.

Each agent should:
- identify risks and missing pieces
- propose specific improvements
- suggest tests

3. Synthesize into a single prioritized list with:
- MUST FIX
- SHOULD FIX
- NICE TO HAVE

Do not implement changes unless the user asks.
