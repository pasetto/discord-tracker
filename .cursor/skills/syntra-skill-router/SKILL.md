---
name: syntra-skill-router
description: >
  Route Syntra agent work to the right skill on demand. Use at the start of any
  non-trivial task to pick which SKILL.md to read — do not load unrelated skills.
---

# Syntra skill router

Goal: **minimum tokens, full capability**. Read a skill file only when the row matches.

## Rules

1. Do **not** read a `SKILL.md` unless the task matches its trigger.
2. Prefer Paperclip `desiredSkills` + Cursor plugin Superpowers over repo copies.
3. Product/domain rules live in root `AGENTS.md` (bootstrap) and `docs/agents-reference.md` (lazy).
4. Git authorship: only `.cursor/rules/git-authorship.mdc`.

## Task → skill

| Task signal | Skill to open |
|-------------|---------------|
| Paperclip heartbeat, issues, checkout, comments, approvals | `paperclip` |
| PARA / daily memory files | `para-memory-files` |
| About to claim done / PR ready | `verification-before-completion` |
| Bug, test failure, unexpected behavior | `systematic-debugging` |
| New feature / bugfix with tests first | `test-driven-development` |
| Written plan exists; execute it | `executing-plans` |
| Ambiguous product/feature design | `brainstorming` |
| Multi-step plan before coding | `writing-plans` |
| Parallel independent subagents | `dispatching-parallel-agents` |
| Finish branch / merge options | `finishing-a-development-branch` |
| Isolated worktree | `using-git-worktrees` |
| Request or receive code review | `requesting-code-review` / `receiving-code-review` |
| Authoring a new skill | `writing-skills` |
| Visual polish / UI craft | `impeccable` (if assigned) |
| Design critique | `design-critique` (if assigned) |
| Marketing copy / launch / CRO / SEO | matching `coreyhaines31/marketingskills/*` if assigned |
| Customer / competitor research | matching research marketing skills if assigned |

## Anti-patterns

- Loading every assigned skill "just in case"
- Re-reading Superpowers process skills that do not apply
- Duplicating inviolables already in root `AGENTS.md`
