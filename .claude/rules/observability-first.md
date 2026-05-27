# Observability First

Observability is not a feature you add after launch. It's scaffolding you set up before the first line of product code.

## The Principle

**If you can't measure it, you can't improve it. If you add measurement later, you've already wasted your most informative runs.**

The first phase run of any project is the most wasteful — and the most valuable to audit. If audit tooling isn't ready before that first run, you lose the baseline data that tells you where to optimize.

## Origin

The factory's first project ran 11 tasks without audit tooling. After building audit.py, we discovered 1.2M chars of wasted context from spec re-reads, 144K from lockfile diffs, and 125K from unfiltered build output. All invisible until we measured. Run 2 (with optimizations informed by the audit) cut context 68%, warnings 89%, and time 68%.

If the audit had existed before Run 1, we would have caught waste during the run and fixed it mid-phase instead of re-running the entire thing.

## Rules

### 1. Audit tooling ships in bootstrap

When `bootstrap.sh` sets up a new project, it must include:

- **Transcript audit** (audit.sh/audit.py) — parses JSONL conversation logs to report context consumed, tool calls, warnings, and timelines per session. Zero LLM cost.
- **Ralph log capture** — every builder/reviewer/fixer session writes its output to `metrics/ralph-task-{ID}-{TIMESTAMP}.log`.
- **Verify reports** — every verification step writes pass/fail results to `metrics/verify-{TASK_ID}-{TIMESTAMP}.txt`.

These exist from task 1.1. Not task 5.1 when you notice things are slow.

### 2. Every phase run produces an audit

After `phase.sh` completes, the operator runs:

```bash
./scripts/audit.sh --all
```

This is a manual step today. It should become automatic — appended to the end of phase.sh.

The audit answers:
- How much context did each session consume?
- Which sessions had warnings (spec re-reads, lockfile diffs, unfiltered output)?
- How many review loops per task?
- Which files were read most often?

### 3. Set targets before running

Before the first phase run, write down what "good" looks like:

```
Total context:       <X chars (start with total tasks * 100K as rough ceiling)
Warning count:       0 (aspirational) or <20 (realistic first target)
Review loops:        1 per task (pass first review)
Reviewer avg ctx:    <50K chars
Full spec reads:     0 (spec slicing should eliminate)
```

After the run, compare actual to target. The delta tells you where to focus.

### 4. Application-level observability follows the same pattern

For the product itself (not just the factory):

- **Structured logging from day one.** Not `console.log("here")`. Structured events with context: `{ event: "profile_save_failed", field: "dateOfBirth", reason: "invalid_format", input: "yesterday" }`.
- **Error boundaries that report, not just catch.** A caught error that's silently swallowed is worse than a crash — at least a crash is visible.
- **User-facing errors trace back to root cause.** "Failed to save profile" is useless. The log must show which validation failed, on which field, with what input.

### 5. The optimization loop is the product

```
Build → Measure → Identify waste → Fix → Build again → Measure again
```

This loop applies to:
- **Factory operations**: audit transcripts → find context waste → tighten prompts
- **Application performance**: profile → find bottlenecks → optimize hot paths
- **User experience**: track error rates → find pain points → fix input flows

Without measurement at each step, you're guessing. Guessing doesn't compound. Data does.

## Checklist for New Project Setup

- [ ] audit.sh/audit.py copied into project by bootstrap
- [ ] metrics/ directory exists and is .gitignored (except README)
- [ ] First phase run produces audit-able JSONL transcripts
- [ ] Targets defined before first run (written in runs/ directory)
- [ ] Application logging uses structured events, not print statements
- [ ] Error messages include enough context to diagnose without reproduction
