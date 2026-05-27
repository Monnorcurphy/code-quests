# BUG: connection.test.ts uses adventurer class values outside the AdventurerClassSchema enum
**Severity:** LOW
**File(s):** packages/server/src/db/__tests__/connection.test.ts

## Problem
The DB CRUD tests use class values that don't exist in `AdventurerClassSchema`:

- Line 90: `INSERT INTO adventurers ... ('adv-2', 'Bram', 'wizard', 'claude-sonnet-4-6')` — `'wizard'` is not in the enum
- Line 184: `INSERT INTO adventurers ... ('adv-q', 'Hero', 'paladin', 'claude-opus-4-7')` — `'paladin'` is not in the enum

`AdventurerClassSchema` enumerates: `'champion' | 'ranger' | 'scout' | 'rogue' | 'apprentice'`. Tests should reflect the contracted domain so that a future reader doesn't assume the DB layer accepts arbitrary class strings as a design choice (it currently does because of the missing CHECK constraint — see review-1.md).

## Expected
Tests should use only the values that the cross-boundary contract permits, so the test suite serves as living documentation of the allowed enum.

## Fix
Replace the out-of-enum values:

- `'wizard'` → `'apprentice'`
- `'paladin'` → `'champion'`

(Once the CHECK constraint is added per review-1.md, these inserts would fail anyway. Fixing these test values is a prerequisite.)
