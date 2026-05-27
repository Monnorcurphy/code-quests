# Testing Requirements

## Test Pyramid
- Unit > Integration > E2E
- Test the most likely failure modes first

## Coverage Expectations
- CRUD test for every database table or data model — insert, read, update, delete
- Unit tests for every command handler, API endpoint, or public function
- Frontend components: render test + interaction test minimum
- E2E tests include accessibility checks (axe-core or equivalent) — zero violations policy

## Pre-Commit Sequence
All commands in the project's verify sequence must pass before committing.
The sequence is defined in CLAUDE.md or factory/profile.yaml.

## Test Isolation
- Mock external dependencies — never call real services from unit/integration tests
- Use the framework's mocking tools (vi.mock, mockall, unittest.mock, etc.)
- Tests must be deterministic — no flaky tests allowed

## Error-Path Testing
- Every async function that calls an external service must have a test where the call rejects
- Verify the user sees an error message, not just that the happy path works
- If using Tauri v2: invoke errors are strings, not Error objects — test with string rejections

## Conditional Assertions (Banned)
- Never wrap assertions in `if (element.isVisible())` or `if (await element.isEnabled())`
- These silently skip when the condition is false — the test passes but validates nothing
- Assert that the element IS visible/enabled unconditionally

## Database Tests
- `PRAGMA foreign_keys = ON` must be set in both production AND test database init
- Without it, FK constraints are silently ignored and tests pass with invalid data
- Every DB table needs insert, read, update, delete tests

## When Tests Fail
- Fix the code, not the test (unless the test is wrong)
- If you cannot fix after 5 attempts, create specs/bugs/blocker-task-{ID}.md
- Never disable or skip a failing test to make the build pass
