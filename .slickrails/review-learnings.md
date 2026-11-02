# Review learnings (.slickrails/review-learnings.md)

The team's accumulated review preferences. Every AI review (the PR
workflow, the local pre-push review, /code-review sessions) reads this
file and honors it — adaptive review without a SaaS in the loop.

Append a dated line whenever a review decision should stick, in either
direction:

- Waive: "don't flag X here, it's deliberate"
- Tighten: "always flag Y in this repo, even at low risk"

A waived finding type is never reported again; a tightened one always is.
Keep entries short and specific — this file is read verbatim by reviewers.

## Learnings

<!-- - 2026-08-24: console.log in scripts/ is fine — don't flag it. -->
<!-- - 2026-08-24: any new SQL string concatenation is a high-risk finding, no exceptions. -->

- 2026-11-02: Tighten: in generated CSS, flag any custom property used without `var()` inside color-mix() or other functions. The theme generator emitted `color-mix(in srgb, --x 12%, --y)`, which is invalid and silently blanked every status wash. The design smoke test now resolves the wash tokens.
- 2026-11-02: Tighten: an optimistic UI side effect (window effects, DOM attributes, localStorage) must be re-synced from the store after `updateSetting`, which swallows write errors and only reverts the store.
- 2026-11-02: Process: a commit went out with a red Playwright test because only the last summary line ("7 passed") was read and "1 failed" was hidden above it. Read the full pass/fail summary, and consider adding `bun run test:playwright` to CHECK_TEST so pre-push catches it.
- 2026-11-02: Tighten: a window that must ignore the app theme (the always-dark overlay) has to override tokens with at least `:root[data-theme]` specificity; plain `:root` loses to theme.css. Smoke tests for such windows must cover the Light theme.
