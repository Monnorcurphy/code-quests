#!/bin/bash
# checks/git-clean.sh — Hard-stop if dirty worktree
# Usage: ./checks/git-clean.sh
# Exit 0 if clean, 1 if dirty

if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
    exit 0
else
    echo "❌ Dirty worktree detected. Commit or stash before proceeding."
    git status --short
    exit 1
fi
