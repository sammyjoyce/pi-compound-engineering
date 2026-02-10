# pi-compound-engineering

Port of EveryInc's **compound-engineering-plugin** to **pi**.

This package provides:
- Slash commands (workflows + utilities)
- Skills (Agent Skills format)
- A `compound_subagent` tool to run bundled reviewer/research agents in parallel

## Install

From a git URL:

```bash
pi install git:github.com/sammyjoyce/pi-compound-engineering
```

Or try locally from a checkout:

```bash
pi -e ./extensions/compound-engineering/index.ts
```

## Usage

Workflow commands:
- `/workflows:brainstorm <idea>`
- `/workflows:plan <idea>`
- `/workflows:work <plan path>`
- `/workflows:review <branch/pr/plan>`
- `/workflows:compound <what we learned>`

Utility commands:
- `/deepen-plan <plan path>`
- `/technical_review <plan path>`
- `/resolve_parallel <path>`
- `/resolve_todo_parallel`
- `/triage`
- `/report-bug`
- `/reproduce-bug`
- `/lfg <idea>`
- `/slfg <idea>`

## Credits

- Based on https://github.com/EveryInc/compound-engineering-plugin (MIT)
- Subagent tool adapted from pi-mono examples: https://github.com/badlogic/pi-mono (MIT)

## Security

Extensions run with full system permissions. Only install packages you trust.
