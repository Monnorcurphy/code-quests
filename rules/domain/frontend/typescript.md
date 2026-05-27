# TypeScript Conventions (Domain Template)

This is a TEMPLATE. Copy it to your project's rules/domain/frontend/ and customize.

- Strict mode always — `"strict": true` in tsconfig
- Never use `any` — use `unknown` and narrow, or define a proper type
- Runtime validators (Zod, etc.) for ALL external data: API responses, IPC messages, form inputs
- File naming: kebab-case (`onboarding-wizard.tsx`, not `OnboardingWizard.tsx`)
  - Rename framework defaults: `App.tsx` → `app.tsx`
  - Exception: framework entry points (main.tsx) stay as-is
- No `console.log` in production code — use a proper logger or remove before committing
  - ESLint should have `'no-console': 'error'` configured
- Diverse examples in UI: use varied career/domain examples, not just software engineering
