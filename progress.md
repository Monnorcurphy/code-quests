# Progress — Phase 7

Previous task progress archived to metrics/progress-before-extratropical-cyclone.md

## extratropical-cyclone — Client store + Phaser scene freeze

- Extended `quest-store.ts` with `inputRequestByQuest` and `userBlockerByQuest` maps plus four new actions: `setInputRequest`, `clearInputRequest`, `setUserBlocker`, `clearUserBlocker`. Updated `reset()` to clear these fields.
- Extended `use-quest-stream.ts`: `paused_input` event → `setInputRequest`; `resumed` event → clears both; `status_change` to `user_blocked` → invalidates query cache and refetches quest REST to populate `userBlocker`; `status_change` to `active` → clears both modal states.
- Extended `base-quest-scene.ts`: subscribes to quest store in `create()`, freezes scene on `paused_input`/`user_blocked` (`tweens.pauseAll()`, `player.pauseAnimations()`, dim overlay or canvas opacity 0.7 for reduced motion), resumes on `active`. Applies initial freeze state immediately on mount. Unsubscribes on `shutdown`.
- Added `pauseAnimations()` / `resumeAnimations()` to `Player`.
- All 587 client tests pass; typecheck and lint clean.
