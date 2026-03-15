# pi-compound-engineering — Agent Guidance

## Project Overview

This is a **pi package** that ports EveryInc's compound-engineering-plugin to pi.
It provides slash commands (prompts/), skills (skills/), and a `compound_subagent` tool (extensions/).

## Repository Structure

- `extensions/compound-engineering/` — TypeScript extension providing the `compound_subagent` tool and agents
- `skills/` — Agent Skills (SKILL.md format) for domain-specific workflows
- `prompts/` — Slash commands (`/workflows:*`, `/triage`, `/lfg`, etc.)
- `package.json` — pi package manifest with `pi.extensions`, `pi.skills`, `pi.prompts` keys

## Key Conventions

### Package Manifest
- The `pi` key in `package.json` declares extension entrypoints, skills dirs, and prompts dirs.
- `peerDependencies` declare pi-agent-core, pi-ai, pi-coding-agent, pi-tui, and typebox — never bundle these.
- `"keywords": ["pi-package"]` is required for pi to discover the package.

### Skills Format
- Each skill lives in `skills/<name>/SKILL.md` with YAML frontmatter.
- Frontmatter fields: `name`, `description`, `disable-model-invocation`, `allowed-tools`, `preconditions`.
- Reference files go in `skills/<name>/references/`, templates in `skills/<name>/templates/`, assets in `skills/<name>/assets/`.

### Prompts (Slash Commands)
- Each prompt is a single `.md` file in `prompts/`.
- Namespaced commands use colons: `workflows:brainstorm.md` → `/workflows:brainstorm`.
- `$ARGUMENTS` placeholder receives user input after the command name.
- Frontmatter `description` field is shown in command help.

### Extension Code
- Written in TypeScript, entrypoint at `extensions/compound-engineering/index.ts`.
- Agent definitions in `agents.ts`, subagent orchestration in `subagent.ts`.
- Agent prompt resources live in `extensions/compound-engineering/resources/agents/<category>/`.

## Lessons Learned

### Compound Engineering Nightly Loop Architecture
**Context:** Automated nightly compound review + auto-compound implementation.
**Pattern:** Two-stage pipeline:
1. **Compound Review (Stage 1):** Reviews Amp threads from last 24h, extracts learnings into `AGENTS.md` files.
2. **Auto-Compound (Stage 2):** Picks top priority from reports, creates PRD, implements, opens draft PR.

**Key decisions:**
- Use **git worktrees** for background jobs to avoid disturbing user's dirty worktree.
- Use `--dangerously-allow-all` flag for automated scripts to prevent hanging on confirmation prompts.
- Correct command syntax is `amp -x` or `amp --execute` (not `amp execute`).

### Prompt Injection Mitigation in Automated Scripts
**Mistake:** Interpolating shell variables directly into LLM prompts.
**Fix:** Wrap dynamic data in XML delimiters to separate data from instructions:
```bash
amp -x "Review threads for <repo>${REPO_NAME}</repo> on <branch>${DEFAULT_BRANCH}</branch>."
```

### Midnight Race Conditions in Automation
**Mistake:** Calling `date` multiple times in scripts running near midnight.
**Fix:** Cache date at script start: `TODAY=$(date +%Y-%m-%d)` and reuse throughout.

### Dynamic Branch Detection
**Mistake:** Hardcoding `main` as the default branch.
**Fix:** Detect dynamically:
```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo "main")
```

### Multi-Repo Discovery Pattern
**Pattern:** Loop over all repos in a directory:
```bash
find ~/git -maxdepth 2 -name .git -type d
```
For each repo: detect default branch, create worktree, run compound review, clean up.

### CI Runner Configuration (NixOS)
- Runner `workDir` and `stateDir` must be **siblings**, not nested — nesting causes deletion conflicts during cleanup.
- Use non-login shells in CI to preserve `nix develop` environment: `nix develop --command bash -euo pipefail -c '...'`
- SSH agent forwarding needed for `sudo nixos-rebuild` with private flake inputs: `sudo SSH_AUTH_SOCK="$SSH_AUTH_SOCK" nixos-rebuild switch --flake .#hostname`

### Shell Script Robustness
- Under `set -o pipefail`, `find` targeting a missing directory makes the whole pipeline fail — append `|| true` if the absence is expected.
- `set -e` (errexit) is disabled inside subshells used as `if` conditions — chain critical steps with `&&`.
- For loop exit logic: handle empty sets explicitly: `[[ ${#REPOS[@]} -eq 0 ]] || [[ ${#FAILED[@]} -lt ${#REPOS[@]} ]]`.

### GitHub PR Management at Scale
- Bulk-resolve bot review threads via GitHub GraphQL `resolveReviewThread` mutation.
- `--admin` cannot bypass external-approving-review requirements if self-approval is forbidden — temporarily lower protection via API if needed.
