# Insights: time saved by dictating

**Status:** active · **As of:** 2026-11-02 · **Built by:** Jonah with Claude Code

## The ask (plain language)

> "Da findest du einen Tacho. Ich fände es irgendwie ganz cool, wenn wir zusätzlich noch einen Word-Tracker oder einen Time-Saved-Feature mit einbauen. Das gibt es aktuell im Handy nicht. Aber das finde ich eigentlich ganz interessant zu sehen, mit wie viel Zeitersparnis ich hatte, dadurch, dass ich diktiere, statt mit der Tastatur zu schreiben."

The "Tacho" is the percentile gauge in the Profound screenshot.

## Decisions

- **Own stats table, not the history.** History keeps only 5 entries by default, so stats built from it would shrink. `dictation_words` (history_id UNIQUE, timestamp, words) lives in history.db, is upserted on every dictation and retry, and is never pruned. Deleting a history entry keeps its words in the stats.
- **Upstream-safe schema.** The table is created with `CREATE TABLE IF NOT EXISTS` from `apply_migrations`, not as a numbered migration, so it never collides with upstream Handy's next migration (this is a fork). It is backfilled once from the dictations still in history.
- **Logic in its own files** (`managers/dictation_stats.rs`, `src/lib/stats/insights.ts`, `src/components/insights/`) and only a few lines in upstream files, to keep merges small.
- **What counts:** dictations only, not file transcriptions. The text counted is the delivered one (post-processed if present). Words are split on whitespace, and in Chinese/Japanese each character counts as a word.
- **Time saved is an estimate:** words ÷ 40 wpm typing − words ÷ 150 wpm speaking. The assumption is shown under the numbers. Rejected for v1: the real audio duration (see open items).
- **Gauge = minutes saved this week (rolling 7 days) against a 60-minute goal**, styled after Profound's percentile gauge: a 240° arc, amber fill, white needle and a goal pill. Insights is the landing page.
- **Aggregation in the frontend** (local time zone, DST-safe day steps); Rust returns only (timestamp, words).

## Where it lives

- `src-tauri/src/managers/dictation_stats.rs`: table, word counting, backfill, queries (+ tests)
- `src-tauri/src/managers/history.rs`: `ensure_table` call, recording in `save_entry`, `get_dictation_words`
- `src-tauri/src/commands/history.rs`: `get_dictation_stats` command
- `src/lib/stats/insights.ts` (+ `insights.test.ts`): aggregation and formula
- `src/components/insights/{Gauge,InsightsPage}.tsx`: UI; `Sidebar.tsx` entry, `App.tsx` landing
- i18n: `insights.*`, `sidebar.insights`

## How to test it

1. `bun run test:insights`: aggregation, 7-day window, invalid values, cap, units.
2. `cargo test --lib dictation_stats`: word counting (CJK, punctuation, empty), backfill excludes files, idempotent, survives pruning.
3. `bun run test:playwright`: `insights show time saved…` (values from mocked data) and `insights report a failed load…`.
4. In the app: dictate a sentence. The Insights page updates (it listens to `transcription-complete-event`).

## Limits & open items

- Use the real `audio_seconds` from `TranscriptionCompleteEvent` instead of the 150 wpm speaking estimate.
- Typing speed and weekly goal are constants; they could become settings.
- Other locales than en/de show English strings.

## History

- 2026-11-02: created
- 2026-11-02: pre-push review: retried dictations were never counted (only `save_entry` recorded). Rows are now keyed by history id and upserted from `save_entry` and `update_transcription`. Create + backfill run in one transaction, and a stats failure only warns. The early dev schema (no `history_id`) is rebuilt from history. The insights listener no longer leaks on a fast unmount.
- 2026-11-02: Jonah questioned "9 min saved" for ~460 words. The math was right (typing 11.5 − speaking 3.1), but the 40 wpm assumption was hidden. The typing speed is now selectable (30–100 wpm, remembered per device) and a math line shows typing vs speaking minutes. Gauge and bars are one flat amber (the blur filter's box read as a 'column'). Cards share 20px padding with 16px heading→content, and bars sit in a fixed track with headroom (max 85%) so they never touch the heading.
