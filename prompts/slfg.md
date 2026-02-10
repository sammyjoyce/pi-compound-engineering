---
description: Run the full workflow with heavier parallelization via compound_subagent
---
# slfg (pi)

## Feature / problem

$ARGUMENTS

If empty, ask what to build and stop.

## Workflow

This is the parallel-leaning version of `/lfg`.

### Phase 1: Plan (parallel research)

- Use `compound_subagent` in **parallel** for repo research + learnings + best practices.
- Write the plan.
- Ask the user to approve before implementation.

### Phase 2: Work (careful parallelism)

If approved:
- Implement mostly sequentially to avoid edit conflicts.
- If there are clearly independent workstreams (e.g., docs + backend + frontend), you may use `compound_subagent` to propose patches in parallel, then apply them sequentially.

### Phase 3: Review (parallel)

Run `compound_subagent` in parallel reviewers (security/perf/simplicity + stack-specific).

### Phase 4: Compound

Write a solution note under `docs/solutions/`.
