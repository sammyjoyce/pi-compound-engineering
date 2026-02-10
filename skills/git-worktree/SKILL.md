---
name: git-worktree
description: Manage Git worktrees for isolated parallel development. Use when you want a clean branch/worktree without stashing or when reviewing in isolation.
---

# Git Worktree Manager

This skill ships a helper script:
- `scripts/worktree-manager.sh`

It wraps `git worktree` and also:
- keeps worktrees under `.worktrees/`
- copies common `.env*` files from the main repo into new worktrees
- ensures `.worktrees/` is in `.gitignore`

## Usage

### Create a worktree

```bash
bash scripts/worktree-manager.sh create <branch-name> [from-branch]
```

Example:

```bash
bash scripts/worktree-manager.sh create feat-login main
```

### List worktrees

```bash
bash scripts/worktree-manager.sh list
```

### Switch (prints target path)

```bash
bash scripts/worktree-manager.sh switch <branch-name>
```

### Copy env files into an existing worktree

```bash
bash scripts/worktree-manager.sh copy-env <branch-name>
```

### Cleanup inactive worktrees

```bash
bash scripts/worktree-manager.sh cleanup
```

## Notes

- Prefer using this script instead of calling `git worktree add` directly.
- If your default branch is not `main`, pass it explicitly as `from-branch`.
