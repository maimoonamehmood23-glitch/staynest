---
name: code-review
description: Review StayNest code changes against the project's own checklist (secrets, validation/SQL sync, error handling, tests, docs). Use before committing or merging any change, or when asked to review code, a diff, or a Jira task's implementation.
---

# StayNest code review

Review the diff (`git diff`, or the files named by the user) and report findings in the exact format below. Do not edit code unless the user asks; this skill reviews.

## Checklist (check every item, every time)

1. **Secrets** – no tokens, passwords, API keys or `service_role` keys in code, docs or commits. `.env` must stay untracked; only `.env.example` with placeholders is allowed.
2. **Validation sync** – if `validateBooking` (`src/utils.js`) changed, the checks in the `create_booking` SQL function (`supabase/`) must still match, and vice versa.
3. **Error handling** – every Supabase call handles `error` and thrown network failures; the user sees a message, never a stuck button or blank screen.
4. **Edge cases** – empty lists, `null`/missing data, `Infinity`/`NaN` from `Math.min`/division, date/timezone handling (use local date, not `toISOString`).
5. **Tests** – new or changed logic in `src/utils.js` has a test in `src/utils.test.js`; `npm test` passes.
6. **Data model** – schema changes are reflected in `supabase/*.sql` and `CLAUDE.md`.
7. **Style** – beginner-friendly, no new dependency without a reason, no dead code or leftover debug logs.
8. **Docs & commits** – README change log updated; commit message is meaningful and includes the Jira key (e.g. `KAN-5: Fix timezone bug in today()`).

## Output format

```
## Review: <files or task>
Verdict: APPROVE | CHANGES REQUESTED

| # | Severity (high/med/low) | File:line | Problem | Suggested fix |
|---|---|---|---|---|

Checklist: 1 ✓/✗  2 ✓/✗  3 ✓/✗ ... 8 ✓/✗
```

Severity guide: **high** = wrong behaviour, data loss, or secret exposure; **med** = missing error handling/tests; **low** = style or docs. If there are no findings, say so and still print the checklist line.

## Why this exists
A fixed checklist and output format makes every review consistent regardless of who (or which session) runs it, and removes the time spent deciding what to look for.
