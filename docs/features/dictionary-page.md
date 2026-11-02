# Dictionary in the sidebar

**Status:** active · **As of:** 2026-11-02 · **Built by:** Jonah with Claude Code

## The ask (plain language)

> "Und macht es Sinn, eine Art Dictionary zu entlegen … oder macht das das Ganze langsamer." / "könnten wir die Funktion, wenn es sie schon gibt, mit dem Dictionary vielleicht in die Seitenleiste ziehen, dass ich da schneller … hinzufügen kann"

## Decisions

- Handy already has custom words. Models with vocabulary support get the words before transcribing; for all others Handy fuzzy-corrects afterwards (A–Z and digits only). Either way it adds practically no time.
- The existing `CustomWords` component moves to its own sidebar page "Dictionary" with a short explanation. It is removed from Advanced so it exists in one place only.
- Not built (possible next step): rules of the form "spoken X → written Y".

## Where it lives

- `src/components/dictionary/DictionaryPage.tsx`, `Sidebar.tsx` entry, `AdvancedSettings.tsx` (removed there)
- i18n: `sidebar.dictionary`, `dictionary.hint`

## How to test it

1. `bun run test:playwright`: `dictionary has its own page…` (adds a word, not in Advanced any more).

## History

- 2026-11-02: created
