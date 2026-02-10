---
name: resolve-pr-parallel
description: Resolve GitHub PR review threads efficiently. Uses gh + jq and the bundled scripts to fetch unresolved threads and mark them resolved. Use when addressing lots of PR feedback.
---

# Resolve PR Comments (Parallel-ish)

This skill helps you:
- fetch unresolved review threads for a PR
- plan fixes
- optionally use subagents to propose fixes per thread
- resolve threads via GitHub GraphQL

## Requirements

- `gh` authenticated (`gh auth status`)
- `jq` installed

## Fetch unresolved threads

```bash
bash scripts/get-pr-comments <PR_NUMBER> [OWNER/REPO]
```

Examples:

```bash
bash scripts/get-pr-comments 123
bash scripts/get-pr-comments 123 EveryInc/cora
```

This prints JSON for unresolved, non-outdated threads (includes `id`, `path`, `line`, and comment bodies).

## Suggested workflow

1. Fetch threads with `scripts/get-pr-comments`.
2. Convert threads into a todo list (group by file/type).
3. For independent threads, you may use `compound_subagent` with `pr-comment-resolver` in parallel to propose patches.
   - Apply patches sequentially to avoid merge conflicts.
4. Once a thread is addressed, resolve it:

```bash
bash scripts/resolve-pr-thread <THREAD_ID>
```

5. Verify:

```bash
bash scripts/get-pr-comments <PR_NUMBER> [OWNER/REPO]
```

Success means the script returns an empty JSON array `[]`.

## Scripts

- `scripts/get-pr-comments` (GraphQL query)
- `scripts/resolve-pr-thread` (GraphQL mutation)
