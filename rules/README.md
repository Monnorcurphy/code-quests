# Rules — Folder Structure

Rules are organized by **when they're loaded**, not alphabetically. This prevents context bloat — each agent gets only the rules relevant to its role and task domain.

## Folders

```
rules/
  core/                      Always loaded for every agent
    constitution.md           Non-negotiables (separation of concerns, etc.)
    security.md               No secrets, least privilege, PII sanitization
    never-skip-review.md      Every task gets full Ralph Loop — no exceptions
  builder/                   Loaded for builder and fixer agents
    context-policy.md         Micro-context rules + fingerprint/pack integration
    build-output.md           Filter build/test output to save context (tail patterns)
    build-checklist.md        End-to-end tool chain verification
    testing.md                Test pyramid, coverage, pre-commit sequence
    manifest.md               Context-aware rule loading by touches
  reviewer/                  Loaded for reviewer agent
    review-contract.md        Reviewer severity taxonomy + filing rules
    common-findings.md        Patterns caught across multiple projects
  domain/
    frontend/                Loaded when task touches UI code
      accessibility.md        WCAG constraints + Tailwind contrast safelist
      input-validation.md     Constrain inputs, don't validate outputs
      ux-feedback.md          Async feedback, loading states, a11y
      typescript.md           TypeScript conventions (domain template)
    backend/                 Loaded when task touches backend/API code
      rust.md                 Rust conventions (domain template)
  spec/                      Loaded for spec generation and phase readiness
    phase-capstone.md         Every phase ends with interactable output
    phase-readiness.md        What must exist before a phase can run
    observability-first.md    Audit tooling ships before product code
```

## How rules are assembled

ralph.sh determines the agent's role and the task's domain, then concatenates only the relevant rule files into the prompt. No agent reads rule files via tool calls — rules are pre-injected.

### Role detection
- **Builder**: builds code from spec
- **Reviewer**: adversarial review of builder output
- **Fixer**: fixes bugs from reviewer

### Domain detection
Inferred from the task spec content:
- References to `.tsx`, `.jsx`, `component`, `tailwind`, `accessibility`, `form`, `UI` → **frontend**
- References to `.rs`, `migration`, `database`, `endpoint`, `API`, `schema` → **backend**
- If ambiguous or both → load both domain folders
- Explicit `## Domain: frontend` tag in task spec overrides inference

## Adding new rules

1. Decide which agents need this rule (builder? reviewer? all?)
2. Decide if it's domain-specific (frontend? backend? universal?)
3. Put it in the right folder
4. Rules in `core/` should be kept minimal — every extra line here costs tokens on every task
