# extensions/compound-engineering — Agent Guidance

## Architecture

- `index.ts` — Extension entrypoint; registers the `compound_subagent` tool with pi.
- `agents.ts` — Agent definitions (reviewer agents, research agents, workflow agents).
- `subagent.ts` — Orchestrates parallel subagent execution; manages concurrency and output aggregation.
- `question.ts` — Interactive question/answer flows for user-facing workflows.
- `todo.ts` — TODO tracking and resolution utilities.
- `resources/agents/<category>/` — Markdown prompt files for each agent persona.

## Agent Categories

- **review/** — Code review specialists (Rails, TypeScript, Python, security, performance, architecture, etc.)
- **research/** — Information gathering (git history, best practices, framework docs, repo analysis)
- **workflow/** — Task automation (linting, PR comment resolution, spec analysis, bug reproduction)
- **design/** — Design implementation review, Figma sync, design iteration
- **docs/** — Documentation generation (ankane-style README writing)

## Conventions

- Agent prompts are plain markdown files in `resources/agents/<category>/`.
- Each agent prompt defines a persona, scope, and output format.
- The `compound_subagent` tool runs multiple agents in parallel and aggregates results.
- TypeScript code uses pi-agent-core, pi-ai, and pi-coding-agent APIs from peerDependencies — never import these directly; they're resolved at runtime by the pi host.

## Lessons Learned

### Subagent Output Handling
**Context:** The `compound_subagent` tool improved UX by better handling of parallel agent output.
**Pattern:** Aggregate results from parallel subagents into a structured summary rather than streaming raw output. This makes results scannable and actionable.

### Worktree Isolation for Background Agents
**Pattern:** When running compound review or auto-compound as background jobs, always use temporary git worktrees:
```bash
WORKTREE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/compound-review.XXXXXX")
trap 'git worktree remove --force "$WORKTREE_DIR" 2>/dev/null || rm -rf "$WORKTREE_DIR"' EXIT
git worktree add "$WORKTREE_DIR" "origin/$DEFAULT_BRANCH" --detach
```
This prevents background automation from conflicting with the user's active working directory.
