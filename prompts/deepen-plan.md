---
description: Enhance a plan using parallel research/review agents
---
# deepen-plan (pi)

## Plan input

$ARGUMENTS

If empty, ask for a plan path and stop.

## Goal

Read an existing plan and make it more production-ready by adding:
- concrete implementation details
- edge cases
- risks
- testing strategy

## Workflow

### 1) Read the plan

If the input is a path, `read` it.

### 2) Run deepening agents in parallel

Use **compound_subagent** in parallel with a small, high-signal set:
- `best-practices-researcher` (patterns / pitfalls)
- `framework-docs-researcher` (framework-specific guidance)
- `security-sentinel` (security concerns)
- `performance-oracle` (perf/scalability)
- `spec-flow-analyzer` (missing user flows / acceptance criteria gaps)

Give each agent the plan path and instruct it to:
- quote relevant parts of the plan
- propose concrete improvements
- call out missing tests and edge cases

### 3) Merge results

Update the plan by:
- preserving original intent
- adding a new section near the top:

```markdown
## Deepening Notes (YYYY-MM-DD)
- ...
```

- enriching acceptance criteria and testing sections

If the user prefers, write a new file with `-deepened` suffix instead of editing in place.

### 4) Next step

Ask whether to:
- run `/technical_review <plan>`
- proceed to `/workflows:work <plan>`
