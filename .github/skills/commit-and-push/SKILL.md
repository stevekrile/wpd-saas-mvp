---
name: commit-and-push
description: "Commit and push the current git repository. Use when the user says commit and push, save my work and publish, check in code and push, or commit changes and sync the branch."
argument-hint: "Optional commit context or scope"
---

# Commit and Push

Use this skill to finish a git change by committing it and pushing the current branch.

## When to Use
- The user asks to commit and push
- The user wants to save work and publish the branch
- The user wants one workflow instead of separate commit and sync requests

## Procedure
1. Confirm the request includes push approval. If the user only asked to commit, do not push.
2. Inspect recent commits to match the repository's commit message convention.
3. Check `git status --short`.
   - If nothing is changed, report that and stop.
   - If changes are already staged, commit only staged changes.
   - If changes are only unstaged, stage them with `git add -A`.
4. Review the staged diff with `git diff --cached --stat` and `git diff --cached`.
5. Create a commit message that matches the repo style.
6. Commit normally. Do not amend, force, skip hooks, or skip signing.
7. Push the current branch to `origin`.
8. Confirm the result with `git status --short` and `git log --oneline -1`.

## Guardrails
- Never force-push.
- Never amend unless the user explicitly asks.
- Never revert unrelated work.
- If hooks modify files or block the commit, stop and explain what happened.
