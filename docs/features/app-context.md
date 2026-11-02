# App context in history

**Status:** active · **As of:** 2026-11-02 · **Built by:** Jonah with Claude Code

## The ask (plain language)

> "in dem Verlauf vielleicht einfach dann in Amber oder so anzeigen, in welcher App wir quasi das Ganze genutzt haben zum Beispiel im Terminal in Slack oder sonst irgendwie was"

## Decisions

- **Captured when the dictation is saved:** the frontmost app (`NSWorkspace.frontmostApplication`). The overlay never takes focus, so this is the app the text goes into. Handy itself is skipped. Other platforms record nothing.
- **Own table `dictation_apps` (history_id → app name, bundle id)**, created idempotently, instead of a new column and `HistoryEntry` field. This keeps the edits to upstream files minimal for later merges.
- **No cleanup on delete:** history ids are AUTOINCREMENT and never reused, so a leftover row can never attach to another entry. That saves hooking upstream's delete and pruning.
- **UI:** an amber pill with the app name next to the date. Entries without a known app show nothing. A failed load just hides the pills.

## Where it lives

- `src-tauri/src/managers/dictation_apps.rs`: table, capture, queries (+ tests)
- `src-tauri/src/managers/history.rs`: `ensure_table`, `record_dictation_app` in `save_entry`, `get_dictation_apps`
- `src-tauri/src/commands/history.rs`: `get_dictation_apps`
- `src/components/settings/history/HistorySettings.tsx`: loads the map, renders the pill
- i18n: `settings.history.appContext`

## How to test it

1. `cargo test --lib dictation_apps`
2. `bun run test:playwright`: `history shows the app each dictation went to`, `history still renders when the app context fails`
3. In the app: dictate into Terminal, then Slack. History shows "Terminal" / "Slack" in amber.

## Limits & open items

- Dictations from before this feature have no app.
- Captured at save time, not at recording start: if you switch apps during a long transcription, the later app is stored.

## History

- 2026-11-02: created
