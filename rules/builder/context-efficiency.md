# Context Window Efficiency

Your context window is finite. Every char of tool output consumes space that could be used for reasoning.

## Read Files Once (HARD RULE)

- Read each file ONCE per session. Reference your earlier read instead of re-reading.
- Use offset and limit parameters instead of re-reading entire files.
- Exception: re-read after you've edited a file to verify changes.

Audit data shows files being read 6x in a single session. That's 5 wasted reads.

## Task Specs: Read ONCE, Then Reference

- Read your task spec file ONCE at the start.
- Do NOT re-read it — reference your notes from the first read.
- Do NOT read orchestration files (phase README, sequence.md, other task specs).
- Builders that re-read their spec 3+ times consume 40% more context.

## Prefer Grep/Glob Over Read for Discovery

- Use Grep to find what you need, then Read only the relevant file.
- Use Glob to find files by pattern, don't `ls -R` or `find`.

## Tail Output: Success vs Failure

Standardized filtering for build/test output:
- **Success path**: `| tail -5` — just the summary line.
- **Failure path**: `| tail -30` — enough context to diagnose.
- NEVER run unfiltered build tool output. Lockfile diffs alone can consume 150K+ chars.

## Complexity Budget

Tasks with more than 3 deliverables should be split into sub-tasks. Large tasks blow up context — a task with 6 deliverables consumed 2.5x the session average.

When writing specs, aim for 1-3 focused deliverables per task.
