# Upstream updates (notice-only)

**Status:** active · **As of:** 2026-11-02 · **Built by:** Jonah with Claude Code

## The ask (plain language)

> "Vielleicht wäre es noch hilfreich ja dort einen Button drin zu haben, um ein Handy Update zu laden. … wie stellen wir quasi sicher, dass wir mitbekommen, dass es ein Update gibt."
> "stelle auch sicher, dass die ganzen Statistiken etc dann auch bleiben, wenn wir ein Update machen"

## Decisions

- **The official updater is never used.** It installs stock Handy from cjpais's releases and would replace the fork (design, insights, app context). The footer's update control is now notice-only.
- **In-app notice:** the footer reads `releases/latest` of cjpais/Handy (8 s timeout, errors only logged) and, when it is newer than the app version, shows "Handy x.y available" in amber. A click opens the release notes; nothing is installed. The tray's "Check for updates" triggers the same check.
- **Weekly GitHub check** (`.github/workflows/upstream-watch.yml`): opens one issue per new upstream release. Issues are off on the fork; until they are enabled, the run fails on purpose with a clear message (GitHub emails failed runs).
- **Bringing an update in** is a merge: `git fetch upstream && git merge upstream/main` on `jonah`, run the checks, rebuild with `APPLE_SIGNING_IDENTITY="Developer ID Application: Jonah Jeschkeit (WFH9R23JGF)" bun run tauri build --bundles app` (a stable signature keeps the macOS permissions), and replace `/Applications/Handy.app`.
- **Data survives updates:** settings, models, history and the fork's tables (`dictation_words`, `dictation_apps`) live in `~/Library/Application Support/com.pais.handy/`, not in the app bundle. Replacing the app keeps them. The fork's tables are created with `CREATE TABLE IF NOT EXISTS` outside upstream's numbered migrations, so upstream schema changes do not touch them.
- Rejected for now: a one-click self-update for the fork. It needs its own release pipeline and signing key.

## Where it lives

- `src/lib/updates/upstream.ts` (+ `upstream.test.ts`): fetch, version compare
- `src/components/update-checker/UpdateChecker.tsx`: footer notice (rewritten; `portableInstaller.ts` is left untouched for easier merges)
- `.github/workflows/upstream-watch.yml`

## How to test it

1. `bun run test:upstream`: version compare, HTTP error, bad body, offline, links never leave github.com.
2. `bun run test:playwright`: `footer announces a newer upstream Handy…` / `footer stays quiet…` (GitHub API mocked).
3. Actions → "Upstream watch" → Run workflow.

## Limits & open items

- Enable Issues on the fork (Settings → General → Features → Issues) to get issues instead of failed runs.
- The rest of upstream's workflows also exist in the fork; disable the ones you don't need to save Actions minutes.

## History

- 2026-11-02: created
- 2026-11-09: merged upstream `73cc8579` (#2432, TLS security advisories: openssl, openssl-sys, rustls, rustls-webpki) before an upstream release, since it is a security fix. Decision: the in-app check stays release-only; single commits on `main` are checked on request.
