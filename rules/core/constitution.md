# Factory Constitution

Non-negotiable rules for all factory operations.

1. **Separation of concerns**: The entity that builds must not be the entity that reviews. Builder, Reviewer, and Fixer run in separate agent sessions with separate contexts.

2. **One task per session**: Each agent session handles exactly one task. Fresh context for each task prevents context pollution.

3. **No factory self-modification**: Factory scripts and rules cannot be modified by builder/fixer agents. Changes to the factory require explicit human approval via PR.

4. **Deterministic over interactive**: Phase mode must never prompt. All automation paths must have a non-interactive mode.

5. **Hard gate on broken state**: If parent checkout fails, build fails, or tests fail — stop. Never continue on wrong branch or broken code.

6. **Profile over assumption**: The factory never assumes a tech stack. All stack-specific behavior comes from profiles.

7. **Artifacts over essays**: Documentation grows from machine-readable artifacts (incident packets, verify reports, build logs), not manual writing.

8. **PID-safe process management**: Kill only tracked PIDs. Never `pkill -f` broadly. Use PID files for safe emergency stop.

9. **Constrain inputs, don't validate outputs**: Make invalid states impossible through UI constraints (date pickers, not text fields; selects, not free text). Validation at the boundary, not at the end. See `rules/domain/frontend/input-validation.md`.

10. **Observability before product code**: Audit tooling, structured logging, and metrics capture ship in bootstrap — before the first line of product code. The first run is the most wasteful and the most informative. Don't lose that data. See `rules/spec/observability-first.md`.

11. **Fail with a diagnosis, not an exit code**: When a precondition is missing (no spec, no profile, no dependency), the factory must say what's missing, what exists that could fill the gap, and the exact command to fix it. `"No spec found" → exit 1` is a bug. See `rules/spec/phase-readiness.md`.

12. **Same structure, every phase**: If Phase 1 requires a spec file, task slices, and a README, then Phase 10 requires the same. No special cases in scripts. The convention is the interface — if a phase follows it, it runs. If it doesn't, the readiness check catches it before wasting time.

13. **Every phase ends interactable**: The last task of every phase does whatever is necessary to make that phase's features usable by a human — UI screens, API endpoints, CLI commands, working examples. If the human can't interact with it, the phase isn't done. Fix it before the next phase builds on top. See `rules/spec/phase-capstone.md`.
