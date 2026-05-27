# Review Contract

Rules for the Reviewer agent.

## Severity Taxonomy

| Severity | Definition | Action |
|----------|-----------|--------|
| CRITICAL | Broken functionality, failing tests, security vulnerability, data loss risk | File bug → Fixer must fix |
| HIGH | Rule violation, missing tests, accessibility failure, misconfiguration | File bug → Fixer must fix |
| LOW | Style nits, debug prints, naming improvements, minor quality | File bug → Fixer should fix |
| INFORMATIONAL | Matches spec, could be improved later, future task concern | Note in review-pass only |

## Filing Rules

- CRITICAL, HIGH, LOW → create `specs/bugs/review-{N}.md`
- INFORMATIONAL → note in `specs/done/review-pass-task-{ID}.md`
- If behavior matches spec exactly → NOT a bug, note in review-pass

## Bug File Format

```markdown
# BUG: [title]
**Severity:** CRITICAL | HIGH | LOW
**File(s):** [affected files]
## Problem
[what is wrong]
## Expected
[what the rules/spec require]
## Fix
[specific steps to fix]
```

## Boundary Contract Validation (Mandatory)

The reviewer MUST verify that values crossing system boundaries match the receiving system's constraints. Mocked boundaries (mocked `invoke()`, `fetch()`, etc.) hide these mismatches — tests pass but the app crashes at runtime.

**Cross-boundary checks:**
1. Read all SQL migrations — extract CHECK constraints and enum columns
2. Compare allowed DB values against: UI option values, schema defaults, store initial state
3. If any value sent from one system doesn't match the receiving system's constraints, file a CRITICAL bug

**Binary asset checks:**
1. Icon files (`.icns`, `.ico`, `.png` in icon dirs) must not be placeholder stubs
2. Config files that reference binary assets must point to valid files
3. If an icon file is under 1KB, file a CRITICAL bug — corrupt icons crash apps silently

**Why CRITICAL:** These mismatches only surface at runtime, after the user interacts with the app. Tests pass because mocks don't enforce real constraints.

## Capstone Coverage (Mandatory for last task of a phase)

When reviewing the last task of a phase, the reviewer MUST verify:
1. Every feature built in this phase is reachable from the app's entry point (UI nav, CLI help, API docs)
2. There are no dead-end screens or unreachable features
3. A human can walk through and interact with everything the phase built

If a feature from an earlier task is unreachable, file a HIGH bug.

## Output Limits

- Maximum 10 bug files per review (prioritize by severity)
- Review-pass file is mandatory (even if 0 bugs)
- Commit all created files
