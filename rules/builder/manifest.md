# Rule File Manifest — Context-Aware Loading

Maps rule files to task contexts based on the "touches" column in sequence.md.
Used by ralph.sh to skip irrelevant rules and save prompt space.

## Always loaded (all tasks)
- rules/core/*.md
- rules/builder/*.md (for builder/fixer) or rules/reviewer/*.md (for reviewer)
  - Includes: context-policy.md, build-output.md, build-checklist.md, code-quality.md, testing.md, manifest.md

## Backend only (touches contains "backend")
- rules/domain/backend/*.md

## Frontend only (touches contains "frontend")
- rules/domain/frontend/*.md

## Both / shared / all
- All domain rules loaded

## How it works
ralph.sh's `assemble_rules()` function detects the task domain from:
1. Explicit `## Domain:` header in the task spec
2. File extension patterns in the spec (`.tsx` → frontend, `.rs` → backend)
3. If neither is detected, loads both (safe default)

This means builder agents receive only the rules relevant to their task,
reducing prompt size and improving focus.
