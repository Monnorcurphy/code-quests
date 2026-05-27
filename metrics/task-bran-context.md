### TASK bran: Adventurer recruit flow + roster

**Goal:** Implement the "spin up a new adventurer from the Town Square" flow end-to-end (US-7 from founding doc §9). Display the guild roster (read from API) and let the user add new adventurers via a recruit modal.

**Files to create/modify:**
- `packages/client/src/features/guild/roster.tsx` — list of adventurers (name, class, wins/losses)
- `packages/client/src/features/guild/recruit-modal.tsx` — form with name + class select (`Champion`/`Ranger`/`Scout`/`Rogue`/`Apprentice`); validated via shared Zod schema; POST to `/adventurers`; on success, optimistic-add via TanStack Query
- `packages/client/src/features/guild/guild-hall.tsx` — the Guild Hall building view; shows roster + recruit button
- `packages/client/src/features/town-square.tsx` — Town Square view; mounts roster as a side panel + recruit banner button
- `packages/client/src/__tests__/recruit-modal.test.tsx` — render, submit happy path, submit invalid path

**Acceptance criteria:**
- Three states required per `rules/domain/frontend/ux-feedback.md`: loading (spinner + disabled submit), success (auto-dismiss after 3s), error (persists until user dismisses)
- Class selector is a `<select>` constrained to the 5 valid classes (no free text — per `rules/domain/frontend/input-validation.md`)
- Name field validated: 1–80 chars, trim, no empty submit
- Failed POST shows the server's field-named error inline (not a generic "failed to save")
- Optimistic insert reverts on error
- New adventurer immediately visible in the roster
- aria-live region announces success to screen readers
- Tests cover the success state, validation error, and server error

---

