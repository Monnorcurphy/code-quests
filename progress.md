# Progress — Phase 10

Previous task progress archived to metrics/progress-before-indus.md

## task-indus (capstone) — DONE

**Town Square ribbon:** Added `LibraryNewsRibbon` component to `town-square.tsx` that shows when `candidateCount >= 1 || !hasOpenedLibrary`. Clicking opens Library on Skills tab.

**Town Store:** Added `hasOpenedLibrary` (localStorage-persisted), `libraryInitialTab`, `markLibraryOpened()`, and `setLibraryInitialTab()` to `town-store.ts`.

**Library:** Updated `library.tsx` to read `libraryInitialTab` from store for initial tab state, call `markLibraryOpened()` on mount, and reset `libraryInitialTab` to `'bestiary'`.

**Armory loadout:** Added "🔓 New skill available" chip beside Skills section heading in `loadout-panel.tsx`. Chip appears when there's at least one active skill not in equipment. Clicking scrolls to first unequipped skill (highlighted in green).

**Seed script:** Extended `seed-dev.ts` with `--phase-10-demo` flag: creates adventurer "Aldric the Learned", epic, 2 complete quests, goblin_linter monster, 3 victory encounters, then calls `evaluateSkillCandidate` to create the candidate skill.

**E2E test:** Created `phase-10-capstone.spec.ts` with 11 tests covering: ribbon, Library Skills tab, confirm flow, Armory chip, Coin New Type, Forge Skill, and axe-core a11y scans.

**Docs:** Added Phase 10 walkthrough to `README.md`; created `specs/done/phase-10-walkthrough.md`.

**CSS:** Added styles for `.library-news-ribbon`, `.armory-column-header`, `.armory-new-skill-chip`, `.armory-item--new`.

All tests: 976 passed. Typecheck: clean. Lint: clean.
