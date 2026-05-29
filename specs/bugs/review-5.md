# BUG: Phase 11 walkthrough screenshots missing

**Severity:** HIGH
**File(s):** assets/screenshots/phase-11/

## Problem

The Phase 11 spec's passing conditions require:

> - [ ] Walkthrough doc + 12 screenshots committed under
>       `specs/done/phase-11-walkthrough.md` and
>       `assets/screenshots/phase-11/`

The walkthrough doc exists (`specs/done/phase-11-walkthrough.md`, 228
lines), but `assets/screenshots/phase-11/` contains only a `.gitkeep`:

```
$ ls -la assets/screenshots/phase-11/
.gitkeep
```

No screenshots have been committed for any of the 12 tour steps. A
human reading the walkthrough doc cannot see what each step looks like
in the actual app.

## Expected

12 PNG/JPEG screenshots committed under `assets/screenshots/phase-11/`,
one per tour step, referenced by file path from
`specs/done/phase-11-walkthrough.md`. The naming should be ordered
(`01-town-square.png` … `12-hall-of-returns.png`) so they sort
naturally.

## Fix

Either:

1. Run the existing screenshot-capture spec/E2E flow against the demo
   app and commit the 12 outputs under `assets/screenshots/phase-11/`
   with stable, ordered filenames; reference each from the
   walkthrough doc.
2. Or, if screenshot automation isn't ready and screenshots will be
   captured later by hand, downgrade the passing condition explicitly
   in `specs/done/phase-11-complete.md` (if it exists) with a note that
   screenshots are deferred to a follow-up task. Do not silently leave
   the requirement unmet.
