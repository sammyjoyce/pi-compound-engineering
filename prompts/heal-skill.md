---
description: Fix common issues in a skill (frontmatter, paths, structure)
---
# heal-skill (pi)

## Input

$ARGUMENTS

Provide a skill path (e.g., `skills/foo/SKILL.md`) or a skill name.

## Workflow

1. Locate and read the skill's `SKILL.md`.
2. Validate:
   - `name` matches directory
   - name formatting (lowercase, hyphens)
   - description is present and <= 1024 chars
   - referenced relative paths exist
3. Fix issues using `edit`/`write`.
4. Summarize what changed.
