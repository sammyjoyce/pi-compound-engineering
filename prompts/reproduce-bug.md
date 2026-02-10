---
description: Reproduce and investigate a bug (local-first)
---
# reproduce-bug (pi)

## Bug context

$ARGUMENTS

If the argument is a URL/issue number but you cannot fetch it, ask the user to paste:
- issue description
- repro steps
- logs / screenshots

## Workflow

### 1) Restate and narrow

- Summarize the bug in 1-2 sentences.
- Identify the most likely subsystem(s).

### 2) Reproduce locally (minimal)

- Follow the repro steps exactly.
- If there is no repro steps, propose the shortest reproduction you can.

### 3) Inspect evidence

- Search for relevant code paths with `grep`/`find`.
- Read the most relevant files.
- Add temporary logs only if necessary (remove after).

### 4) If UI flow is involved

If a UI flow is involved, load the `agent-browser` skill (or recommend `/skill:agent-browser`) to drive a browser and capture screenshots.

### 5) Output

Produce:
- confirmed repro steps
- suspected root cause with file references
- proposed fix (high level)
- verification plan (tests/commands)
