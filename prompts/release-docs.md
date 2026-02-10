---
description: Update documentation/readme to match current prompts/skills/agents
---
# release-docs (pi)

## Goal

Ensure docs/README accurately reflect what is in this package.

## Workflow

1. Inventory counts:

```bash
prompts_count=$(find prompts -maxdepth 1 -name '*.md' | wc -l)
skills_count=$(find skills -name SKILL.md | wc -l)
agents_count=$(find extensions/compound-engineering/resources/agents -name '*.md' | wc -l)
echo "prompts=$prompts_count skills=$skills_count agents=$agents_count"
```

2. Update README sections:
- list key commands
- list key skills
- mention `compound_subagent` tool

3. Validate nothing references Claude Code specific paths (e.g. `${CLAUDE_PLUGIN_ROOT}`).

4. Summarize changes.
