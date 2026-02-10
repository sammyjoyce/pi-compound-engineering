---
description: Run the full compound workflow (plan → work → review → compound)
---
# lfg (pi)

## Feature / problem

$ARGUMENTS

If empty, ask what to build and stop.

## Workflow

You are running a full end-to-end workflow. Execute phases in order.

### Phase 1: Plan

- Create a plan as in `/workflows:plan` (run local research via `compound_subagent`).
- Write the plan file.
- Ask the user to approve before implementation.

### Phase 2: Work

If approved:
- Implement as in `/workflows:work`.
- Track tasks via the `compound_todo` tool.

### Phase 3: Review

- Run `/workflows:review` style parallel reviewers via `compound_subagent`.
- Address critical issues.

### Phase 4: Compound

- Capture the key learning(s) as in `/workflows:compound`.

End with a concise ship-ready summary + how it was tested.
