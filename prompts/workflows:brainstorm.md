---
description: Explore requirements and approaches before planning
---
# workflows:brainstorm (pi)

**Note: The current year is 2026.** Use this when dating notes or searching docs.

## Idea

$ARGUMENTS

If the idea above is empty, ask the user: "What would you like to brainstorm?" and stop.

## Goal

Help the user clarify:
- What to build (scope)
- Why (motivation)
- Constraints (time, security, performance, compatibility)
- Success criteria (what "done" looks like)

## Workflow

1. Restate the idea in 1-2 sentences.
2. Ask clarifying questions **one at a time**. Prefer concrete questions:
   - Who is this for?
   - What is the primary user flow?
   - What must not change (constraints / non-goals)?
   - What are the acceptance criteria?
   - What are the biggest risks?
3. Propose 2-3 implementation approaches (high-level), with tradeoffs.
4. Recommend one approach and explain why.

## Output

End with:

### Brainstorm Summary
- **Problem:** ...
- **Proposed solution:** ...
- **Non-goals:** ...
- **Open questions:** ...
- **Acceptance criteria (draft):**
  - [ ] ...
  - [ ] ...

### Next step
Ask: "Proceed to /workflows:plan?"
