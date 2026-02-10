---
description: Audit a codebase against agent-native architecture principles
---
# agent-native-audit (pi)

## Focus (optional)

$ARGUMENTS

If a specific principle is provided (e.g., "action parity"), focus there.

## Workflow

1. Load the reference skill:
- Load the `agent-native-architecture` skill (or run `/skill:agent-native-architecture`)

2. Run the bundled reviewer agent in depth:
- Use **compound_subagent** with `agent-native-reviewer`.

In the task, ask it to:
- score each principle (0-5)
- cite evidence with file paths
- list top recommendations

3. Synthesize a final report:
- overall score
- strengths
- gaps
- top 10 recommendations (impact vs effort)
