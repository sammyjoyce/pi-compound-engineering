---
description: Generate a new pi prompt template (slash command)
---
# generate_command (pi)

## Input

$ARGUMENTS

If empty, ask:
- command name (what the user will type after `/`)
- description
- expected arguments

## Output

Create a new prompt template file:
- `prompts/<command-name>.md`

Template:

```markdown
---
description: <one-line description>
---
# <command-name>

$ARGUMENTS

<instructions>
```

Prefer short, direct instructions. Avoid tool names that do not exist in pi.
