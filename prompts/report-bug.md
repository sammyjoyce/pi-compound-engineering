---
description: Gather a structured bug report (optionally create a GitHub issue)
---
# report-bug (pi)

## Summary

$ARGUMENTS

If empty, ask: "What bug are you reporting?" and stop.

## Workflow

1. Ask for:
   - component (command/skill/agent/tool)
   - actual behavior
   - expected behavior
   - steps to reproduce
   - error output (if any)

2. Collect environment info via `bash`:

```bash
pi --version || true
uname -a || true
node --version || true
```

3. Produce a markdown bug report:

```markdown
## Summary

## Component

## Environment

## Actual behavior

## Expected behavior

## Steps to reproduce

## Logs / errors
```

4. Ask the user:
- "Do you want me to create a GitHub issue? If yes, which repo (owner/name)?"

If the user provides a repo and confirms, use:

```bash
gh issue create --repo OWNER/REPO --title "Bug: <short title>" --body-file <file>
```

If `gh` is not authenticated, instruct the user to run `gh auth login`.
