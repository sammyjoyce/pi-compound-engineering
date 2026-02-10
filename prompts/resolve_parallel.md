---
description: Resolve TODO/FIXME comments using parallel subagents (carefully)
---
# resolve_parallel (pi)

## Scope

$ARGUMENTS

Optional: provide a pattern or file path to narrow the search.

## Workflow

1. Find TODO/FIXME items:
   - Use `grep` (ripgrep) for `TODO|FIXME` (narrow to `$ARGUMENTS` if provided).
2. Convert findings into a `compound_todo` list (group by file or type).
3. Decide dependency order (if a rename/refactor affects multiple items, do it first).
4. For independent items, use **compound_subagent** in parallel with `pr-comment-resolver` to propose fixes.
   - Prefer: subagents propose patches + you apply sequentially to avoid merge conflicts.
5. Run tests and summarize.
