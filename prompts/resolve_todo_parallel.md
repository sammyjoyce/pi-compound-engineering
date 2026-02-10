---
description: Resolve items from the todo list using parallel subagents (carefully)
---
# resolve_todo_parallel (pi)

## Input

$ARGUMENTS

Optional: todo id/text filter.

## Workflow

1. List current todos via the `compound_todo` tool.
2. If a filter is provided, narrow to matching items.
3. For each todo item:
   - If independent, you may run **compound_subagent** in parallel with `pr-comment-resolver` to suggest a fix.
   - Apply changes sequentially (avoid conflicting edits).
4. After each fix:
   - run the relevant tests
   - mark the todo done

5. Finish with a summary + remaining todos.
