# Context Policy

Rules for managing token usage and agent context.

## Micro-Context Principle

Agents receive the minimum context needed for their role. Less context = faster, cheaper, more focused output. Rules are pre-assembled by ralph.sh and injected directly into the prompt — agents do NOT read rule files via tool calls.

### Builder Agent
- Receives: CLAUDE.md + task-specific spec + core rules + builder rules + domain rules
- Does NOT read: entire founding document, other phase specs, previous task logs

### Reviewer Agent
- Receives: CLAUDE.md + core rules + reviewer rules + domain rules + pre-computed diff
- Does NOT read: spec files (reviews against rules, not spec), build logs
- Does NOT run `git diff` — the diff is pre-computed and embedded in the prompt

### Fixer Agent
- Receives: CLAUDE.md + core rules + builder rules + domain rules + bug files
- Does NOT read: spec files, reviewer logs, full git history

## HARD RULES

### Read files once per session
Read each file ONCE. Reference your earlier read for subsequent uses. Audit data shows files read 6x in a single session — that's 5 wasted reads (~10K chars burned for nothing). If you catch yourself about to re-read a file, STOP and reference your notes.

Exception: re-read after you've edited a file to verify changes.

### Task specs: read ONCE, then reference
- Read your task spec file ONCE at the start of your session.
- Do NOT re-read it — reference your mental notes from the first read.
- Do NOT read the phase README, sequence.md, or other task specs. They contain phase-level orchestration info that wastes builder context.
- Do NOT read progress.md before building. Only open it to APPEND your completion notes after all code and tests are done.

Audit data: builders that re-read their task spec 3+ times consumed 40% more context than those who read once.

### Prefer Grep/Glob over Read for discovery
- Use Grep to find what you need, then Read only the relevant file.
- Use Glob to find files by pattern — don't `ls -R` or `find`.
- Read is for known files. Grep/Glob is for discovery.

### Use targeted reads
- If the task has a context pack file, read it instead of individual files.
- If you need a specific section, use offset/limit parameters instead of re-reading the entire file.

### Filter build output
All build/test/lint output must be piped through `tail` or `grep`:
- Success path: `| tail -5`
- Failure path: `| tail -30`
- Never run raw test/build commands without filtering
- See `rules/builder/build-output.md` for detailed patterns

### Task complexity budget
Tasks with more than 3 deliverables (files to create, features to implement) should be split into sub-tasks. Oversized tasks consume 2-3x the context of focused tasks. Field data: task 1.9 consumed 391K chars (2.5x session average) because it packed too many deliverables.

## Context Pack Integration

When a context pack file exists (`metrics/context-<codename>.md`):
- Read it ONCE at the start — it contains pre-bundled excerpts of key files
- Do NOT re-read the individual files excerpted in the pack
- If the pack seems incomplete, THEN read the missing file as a fallback

## Fingerprint Integration

When ralph.sh provides an unchanged-files list:
- These files have not changed since the previous task
- Do NOT read them — reference your knowledge from the current session or trust the pack

## Artifact Scope

- Review artifacts (`specs/bugs/review-*.md`) are scoped to the current task
- Clean stale artifacts before each review step
- Verify reports are timestamped and never overwritten
- progress.md is archived after each task to prevent late-phase context bloat. Full history is saved to `metrics/progress-before-<codename>.md` before truncation. When updating progress.md, append your task section — don't rewrite the whole file.
- Changed-files manifests (`metrics/changed-files-*.txt`) inform downstream tasks
