# Phase Capstone

Every phase must end with a capstone task that makes the phase's output **interactable by a human**.

## The Principle

**Working code that nobody can interact with is indistinguishable from broken code.**

A phase that builds backend logic without a way to invoke it, UI components without navigation to reach them, or a library without an example to run it — that phase produced dead code. It compiles, tests pass, but no human can verify it does what they wanted.

The capstone is a verification gate: if a human can't interact with the phase's output, the phase isn't done. Fix it before the next phase builds on top.

## What "interactable" means by project type

| Project type | What the human must be able to do | Examples |
|---|---|---|
| Desktop/mobile app | Navigate to and use new features | Screens, routes, sidebar entries, dialogs |
| Web app (frontend) | Visit and interact with new pages | Routes, menu items, dashboard widgets |
| Backend API | Call new endpoints and see results | REST/GraphQL routes, seed data, health checks |
| CLI tool | Run new commands | Subcommands, help text, example invocations |
| Library/SDK | Run working examples | Example scripts, REPL demos, quickstart docs |
| Infrastructure | Observe system state | Dashboards, status endpoints, runbook entries |
| Data pipeline | Trigger and inspect runs | Sample input, manual triggers, output viewers |

The specific form varies. The requirement doesn't: a human must be able to use what the phase built.

## Why this matters

The capstone creates a feedback loop between phases:

```
Phase N builds features → Capstone makes them interactable →
Human verifies intent → Problems found? Fix spec, re-run phase →
Phase N+1 builds on verified foundation
```

Without this:
- The next phase builds on features nobody has manually tested
- Problems in flow, navigation, and discoverability compound across phases
- The human loses the ability to steer — they approved specs but never saw the result
- By Phase 4, you're debugging Phase 2 assumptions buried under two layers of code

With this:
- Every phase ends with a demo-able state
- The human catches mismatches between intent and implementation immediately
- If it's broken, you fix the spec and re-run the phase — not three phases later

## Rules

### 1. Every phase spec includes a capstone as its final task

The last `## TASK N.{last}` in every phase spec must be a capstone task. It does whatever is necessary — backend, frontend, wiring, new endpoints, new screens — to make the phase's features interactable.

### 2. The capstone does whatever it takes

There is no restriction on what the capstone can build. If making the phase interactable requires a new API endpoint, a navigation sidebar, seed data, or a CLI wrapper — the capstone builds it. The constraint is on the *outcome* (human can interact), not on the *implementation*.

If earlier tasks should have built something the capstone needs, that's useful information for the next run — but the capstone still ships it now.

### 3. Passing conditions describe a human interaction path

The acceptance criteria must describe what a human does, not just what the code does:

```
GOOD: "User opens sidebar → clicks 'Analytics' → sees dashboard with
       live data from the metrics service built in tasks 3.1-3.4"

GOOD: "Developer runs `curl localhost:3000/api/jobs` → gets JSON array
       of seeded job records with all fields from the schema"

BAD:  "Analytics dashboard component renders without errors"
BAD:  "API handler function exists and has unit tests"
```

Tests verify the code works. The capstone verifies a human can reach it.

### 4. The reviewer checks capstone coverage

During review of the capstone task, the reviewer must verify:
- Can every feature built in this phase be reached by a human?
- Is there a path from the app's entry point to every new feature?
- Are there dead-end states (features that work but can't be discovered)?

If a feature is unreachable, file a bug.

## Capstone task naming

The capstone is always the LAST task of the phase:
- Pattern: `specs/phase-NN/task-<codename>-<descriptive-name>.md`
- The codename is the last in the phase's `sequence.md`
- The descriptive name should indicate integration (e.g., "app-shell", "desktop-integration", "cli-wiring")

## Anti-pattern: what the capstone is NOT

- NOT a "write docs" task — it writes code
- NOT optional if "all the features were built in earlier tasks" — even then, verify navigation and discoverability work end-to-end
- NOT just a smoke test — it adds real integration glue (routing, navigation, status indicators, empty states)

## Pre-Capstone UX Review

Before the capstone task runs, the factory should run a UX audit:

```bash
./core/scripts/ux-review.sh <phase-number>
```

This catches UX issues (missing empty states, bad error copy, no loading feedback) BEFORE the capstone wires everything together. The capstone can then fix UX bugs alongside integration work, rather than shipping them for manual QA to find later.

The UX review is not a gate (it doesn't block the capstone). It's a feed-forward: issues found become additional requirements for the capstone.

## Post-Phase Bug Bash

After the capstone completes and the phase is marked done, run a bug bash:

```bash
./core/scripts/bug-bash.sh
```

This runs static checks + agent code audit to find issues that escaped all previous gates. Bugs are filed with severity tiers and a catalog is generated. P0 bugs should be fixed before starting the next phase.

## Checklist for spec authors

When writing or reviewing a phase spec:

- [ ] Last task is a capstone task
- [ ] Capstone references all features built in earlier tasks of this phase
- [ ] Passing conditions describe a human interaction path, not just "renders"
- [ ] Entry point (sidebar, menu, CLI help, API docs) updated to include new features
- [ ] UX review scheduled before capstone (or as first step of capstone)
- [ ] Bug bash scheduled after phase completion
