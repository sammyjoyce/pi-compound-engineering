---
description: Create an engaging changelog for recent merges
---
# changelog (pi)

## Time period

$ARGUMENTS

If empty, default to last 24h.

## Workflow

1. Determine default branch (`main`/`master`).
2. Collect recent merges/commits:

```bash
# example: last 24h
since="24 hours ago"
git log --since="$since" --oneline --decorate --no-color
```

If `gh` is available and the repo uses PRs, optionally enrich with PR titles:

```bash
command -v gh >/dev/null && gh pr list --state merged --limit 20
```

3. Produce a changelog grouped by:
- Breaking changes
- Features
- Fixes
- Other

Keep it concise (Discord-friendly if requested).
