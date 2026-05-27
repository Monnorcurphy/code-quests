# Never Skip Review (Non-Negotiable)

- Every task goes through the FULL Ralph Loop: Build → Verify → Review → Fix → PR
- NEVER skip the review step, even for "simple" tasks
- NEVER skip verification (tests, lints, typechecks)
- NEVER use a cheaper/faster model for review — always use the adversarial reviewer model
- The builder and reviewer MUST be different agents with different contexts
- If a review finds 0 bugs, that's a clean pass — it does NOT mean review was unnecessary
- Field data: 25 bugs found and fixed in-loop during Attempt 1, zero escaped to production
