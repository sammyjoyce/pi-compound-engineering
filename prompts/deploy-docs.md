---
description: Validate package structure before publishing/deploying docs
---
# deploy-docs (pi)

This package does not ship a GitHub Pages site by default, but you can still validate readiness.

## Checks

Run:

```bash
# basic structure
ls -la

# prompts
ls -la prompts | wc -l

# skills
find skills -name SKILL.md | wc -l

# extension entry
ls -la extensions/compound-engineering/index.ts
```

If you have a docs site, ensure:
- links are valid
- counts match
- no missing pages

End with a readiness summary + next steps.
