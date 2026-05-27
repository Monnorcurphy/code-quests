# Code Quality — Quantitative Limits

Hard numbers to prevent sprawl. These are defaults — projects may override in `factory/profile.yaml` under `quality_limits:`.

## File length (linter: `max-lines`)
- **Components / views**: 300 lines max
- **Modules / services**: 500 lines max
- **Test files**: exempt (test suites can be long)
- If a file exceeds its limit, split by responsibility into a colocated folder:

```
Before: src/components/upload.tsx  (400 lines)
After:  src/components/upload/
          ├── index.tsx        (re-exports)
          ├── upload-form.tsx   (form UI)
          ├── file-preview.tsx  (preview panel)
          └── use-upload.ts    (hook)
```

## Function length (linter: `max-lines-per-function`)
- If a function is longer, extract helpers or split into steps
- Exception: generated code, data tables, and switch/match blocks with many simple arms

## Parameters (linter: `max-params`)
- **4 parameters max** per function signature
- If you need more, group related params into an options/config object
- Booleans in parameter lists are a smell — prefer named options or enums

## Nesting depth (linter: `max-depth`)
- **3 levels max** (function body → if → loop is the limit)
- Use early returns, guard clauses, or extracted functions to flatten
- Deeply nested code is the #1 predictor of bugs in reviewed tasks

## Cyclomatic complexity (linter: `complexity`)
- **15 max** per function
- Measure: count decision points (if, else, for, while, case, &&, ||, ?:) + 1
- If you can't easily explain the function's control flow, it's too complex

## Rule of Three
- **1st occurrence**: inline — just write the code
- **2nd occurrence**: add a comment noting the duplication
- **3rd occurrence**: extract into a shared helper/utility
- Do NOT extract on the first or second occurrence — premature abstraction costs more than duplication

## Import depth
- Never use more than **2 levels** of `../` — configure path aliases instead
- Use `@/` or package imports for cross-package references
- If you need deeper imports, the module structure needs refactoring

## Dead code
- No commented-out code in committed files — git has history
- No unused imports, variables, or functions — run your linter
- No TODO/FIXME without a linked task — stale TODOs are dead code with extra guilt
