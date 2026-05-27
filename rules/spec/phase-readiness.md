# Phase Readiness

A phase that can't be run is worse than a phase that doesn't exist. An empty directory with a README creates the illusion of progress. The factory must know the difference between "ready to run" and "has a placeholder."

## The Principle

**Every phase must be self-describing enough that phase.sh can run it — or explicitly declare what's missing and how to fix it.**

No silent failures. No "No spec found" followed by exit 1. If a phase isn't ready, the factory tells you exactly what it needs, in what format, and offers to generate it from what already exists.

## Origin

A typical project has 10 phases. Phase 1 has a full spec (`specs/features/phase-1-foundation.md`) with 11 task definitions, individual task slices (`specs/phase-1/task-1.1-*.md`), and was successfully run twice. Phases 4-10 have placeholder READMEs with preliminary outlines but no spec files. Running `phase.sh 4` crashes with "No spec found for phase 4" — a dead-end error that tells you nothing about what to create.

The gap: there's no contract that defines what "runnable" means. Phase 1 was built by hand. Phases 2-3 were hand-written later. Phases 4-10 were left as ideas. Nothing enforces consistency.

## The Phase Readiness Contract

A phase is **runnable** when all of these exist:

### Required (hard gate — phase.sh cannot start without these)

1. **Phase spec file**: `specs/features/phase-{N}-{name}.md`
   - Contains `## TASK {N}.{M}` headings that phase.sh can parse
   - Each task section has: goal, acceptance criteria, and files to create/modify
   - This is the file the builder agent reads

2. **Task count > 0**: At least one `TASK {N}.X` parseable from the spec
   - phase.sh greps for `TASK {N}.\d+` — if zero matches, it can't do anything

### Recommended (warn if missing, don't block)

3. **Individual task slices**: `specs/phase-{N}/task-{N}.{M}-{name}.md`
   - Pre-sliced specs that reduce builder context (learned from Phase 1 audit)
   - If missing, ralph.sh falls back to injecting the full phase spec (works but wasteful)

4. **Phase README**: `specs/phase-{N}/README.md`
   - Human-readable summary: goal, key tasks, passing conditions
   - Useful for orientation but not consumed by automation

5. **Profile compatibility**: Profile defines all commands needed by this phase's tasks
   - If Phase 4 introduces Rust but the profile only has node-react commands, verification will have gaps

6. **Capstone task**: The last task in the spec is a capstone/integration task
   - Wires all features into the interactable surface (UI, API, CLI, examples)
   - If missing, the phase produces working code that nobody can reach
   - See `rules/spec/phase-capstone.md`

### Absent (the gap state — needs generation)

6. **Founding document sections exist but spec doesn't**: The source material is there (founding document, phase README with section references) but nobody has turned it into a structured spec with TASK headings.

## What Should Happen When a Phase Isn't Ready

Today: `"No spec found for phase 4"` → exit 1. Dead end.

What should happen instead:

### Level 1: Diagnose and report (minimum viable fix)

```
Phase 4 is not ready to run.

Missing:
  [REQUIRED] specs/features/phase-4-*.md — no phase spec file found
  [RECOMMENDED] specs/phase-4/task-4.*.md — no task slices found

Found:
  specs/phase-4/README.md — preliminary outline exists (6 tasks described)
  specs/founding-document.md — sections 6, 9, 10, 12, 13, 16, 4, 8 referenced

To generate the spec:
  ./core/scripts/spec-gen.sh 4

To write it manually:
  Create specs/features/phase-4-pipeline.md with ## TASK 4.1 through ## TASK 4.N headings.
  Each task needs: goal, acceptance criteria, files to create/modify.
```

This tells the operator exactly what's missing, what exists that could be used, and the two paths to fix it.

### Level 2: Auto-generate from existing materials (spec-gen)

A `spec-gen.sh` script that:
1. Reads the phase README for preliminary task descriptions
2. Reads the founding document sections referenced in the README
3. Produces a draft `specs/features/phase-{N}-{name}.md` with structured TASK headings
4. Writes it as a draft (operator reviews before running phase.sh)

This is the "involve the human only if needed" path. The factory does the mechanical work (extracting sections, formatting tasks) and the human approves the result.

### Level 3: Preflight before every phase run

phase.sh runs the readiness check before attempting any tasks:

```bash
# Before the task loop
check_phase_readiness "$PHASE" || exit 1
```

This catches structural problems immediately instead of after 30 minutes of successful tasks that then hit a wall.

## Structural Consistency Rules

These apply to all phases, not just the first one:

### 1. Same structure, every phase

```
specs/features/phase-{N}-{name}.md     # REQUIRED: the spec file
specs/phase-{N}/README.md              # RECOMMENDED: human overview
specs/phase-{N}/task-{N}.{M}-{name}.md # RECOMMENDED: pre-sliced task specs
```

If Phase 1 has it, Phase 10 must have it (or the readiness check flags the gap).

### 2. No special cases in scripts

phase.sh and ralph.sh must not contain `if phase == 1 then ... else ...` logic. The convention (`specs/features/phase-{N}-*.md`) is the interface. If a phase follows the convention, it runs. If it doesn't, the readiness check catches it.

### 3. Specs are generated forward, not retrofitted

When planning a new phase, create the spec file first — before writing any code. The spec is the input to the factory, not an artifact of its output. Placeholder READMEs are fine for brainstorming but they must be promoted to real specs before phase.sh runs.

### 4. The founding document is source material, not the spec

The founding document is long (200K+ chars). Agents should never read it directly. It feeds into phase specs via slice-spec.sh or spec-gen.sh. The spec file is the contract between the human and the factory.

## Checklist for Phase Readiness Review

Before running `phase.sh N`:

- [ ] `specs/features/phase-{N}-*.md` exists
- [ ] Spec contains `## TASK {N}.1` through `## TASK {N}.{last}`
- [ ] Each task has a goal sentence, acceptance criteria, and files-to-modify list
- [ ] Profile covers all build/test/lint commands this phase needs
- [ ] Previous phase's PRs are merged (phase N depends on phase N-1 output)
- [ ] progress.md is archived from previous phase (prevents context bloat)
- [ ] Last task is a capstone that wires features into the interactable surface
- [ ] Specs include UX criteria (not just "renders" — describe what the user sees and does)
- [ ] Specs describe error states, empty states, and loading states — not just happy paths
- [ ] Cross-boundary data flows identified (frontend↔backend enum values, schema fields)
- [ ] Known gotchas from previous phases documented in spec (e.g., "use typeof not instanceof for Tauri errors")
