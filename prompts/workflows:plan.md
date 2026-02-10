---
description: Transform a feature description into a concrete implementation plan
---
# workflows:plan (pi)

**Note: The current year is 2026.** Use this when dating plans.

## Feature description

$ARGUMENTS

If the feature description above is empty, ask the user: "What would you like to plan?" and stop.

## What to produce

- A single markdown plan file under `docs/plans/` (create the directory if needed)
- The plan should be actionable: tasks, file touchpoints, and acceptance criteria

## Workflow

### 1) Quick local research (parallel)

Use the **compound_subagent** tool to run these in parallel (they are bundled with this package):

- `repo-research-analyst`: find repo conventions, relevant existing code, testing commands
- `learnings-researcher`: scan `docs/solutions/` (if present) for relevant prior learnings

Provide the feature description as context and ask for file/line references.

### 2) Decide plan type + filename

Pick one: `feat`, `fix`, or `refactor`.

Filename format:

- `docs/plans/YYYY-MM-DD-<type>-<short-slug>-plan.md`

Example:
- `docs/plans/2026-02-10-feat-add-session-expiry-plan.md`

### 3) Write the plan

Write a plan with these sections:

- **Overview** (what/why)
- **Assumptions** (explicit)
- **Acceptance Criteria** (checkboxes)
- **Non-goals**
- **Technical Approach**
  - touched components/files (anticipated)
  - data model / API changes (if any)
  - error handling
  - observability (logs/metrics)
- **Implementation Steps** (ordered checklist)
- **Testing** (exact commands)
- **Risks / Rollout**
- **References** (file paths, links)

Use the research results to ground the plan (cite file paths).

### 4) Ask for next action

After writing the plan, ask what to do next:
- proceed to `/workflows:work <plan path>`
- run `/deepen-plan <plan path>`
- run `/technical_review <plan path>`

Do not start implementing until the user confirms.
