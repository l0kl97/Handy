# Premium design + glass effect

**Status:** active · **As of:** 2026-11-02 · **Built by:** Jonah with Claude Code

## The ask (plain language)

> "nutze https://developer.apple.com/design/human-interface-guidelines und kreiere ein modernes premium design, gerne mit einer Einstellung für den Glass Effect. Ich will kein Pink. Die designsprache von https://www.tryprofound.com/ finde ich sehr cool."

Jonah also shared two screenshots of tryprofound.com: black canvas, a sidebar with grey active rows, solid white primary buttons, dashed hairline grids, colour only as signal (blue gauge, red/green status).

## Decisions

- **Round 2 (same day):** Jonah sent a screenshot of Profound's app UI and asked to push further ("Dark, clean premium"), restyle the transcription widget and make the glass "more Liquid Glass".
- **Dark-first.** New installs default to Dark (Rust `default_theme`, boot fallback in `theme.ts`). Dark layers follow Profound: sidebar `#0b0b0c`, panel `#141415`, cards `#1a1a1c`. The big page title became a 14px toolbar title on the traffic-light line, as in Profound's app.
- **Widget is always dark**, whatever the theme: a deep gradient body, a bright rim along the top edge, white live bars, an accent bloom underneath (`RecordingOverlay.css`, `--s-*` variables).
- **Liquid Glass is native.** Tauri's `setEffects` only knows the older vibrancy, so `src-tauri/src/glass.rs` inserts an `NSGlassEffectView` (macOS 26+, looked up at runtime) behind the webview, falling back to sidebar vibrancy. Rust applies it at startup and from `change_glass_effect_setting`; the frontend only toggles `data-glass`. The CSS adds the Tahoe look: a floating sidebar pane (8px inset, 18px radius, specular rim), a borderless panel and rim-lit cards. `prefers-reduced-transparency` turns the layers opaque again.
- **Monochrome first, one accent: amber.** Primary buttons are solid ink (white on dark, near-black on light). The accent marks state only: switches, progress, focus, the recording dot and glow. Red, green and yellow (warning) are status only. Rejected: keeping a saturated brand colour on every primary button (the old pink pattern).
- **Accent changed from blue to amber (round 3).** The first pass took Profound Blue `#376CFF` from their brand page. Jonah pointed out that the app screenshots he showed use amber/orange as the accent (Recents icons, the badge), so the accent is now amber (`#ff8a3d` dark, `#d9661a` light, near-black text on it). Warning moved to yellow so it does not read as the accent.
- **Token swap instead of a file-by-file rewrite.** ~49 files used `logo-primary` / `background-ui`; both now resolve to `--color-accent`, so the whole app follows from `src/styles/theme.css`. New layers: `canvas` (window/sidebar), `background` (content panel), `surface` / `surface-2` (cards, controls).
- **HIG:** SF Pro Display/Text (system font, no longer SF Pro Rounded), inset title bar with traffic lights over the sidebar (`TitleBarStyle::Overlay`), 8–12px radii, HIG-sized switch, one accent focus ring.
- **Glass = real vibrancy, not CSS blur.** On macOS the main window is created transparent; the toggle calls `setEffects(Effect.Sidebar)` / `clearEffects()` and sets `data-glass="on"`, which lowers the layer alphas in `theme.css`. With glass off, every layer is opaque, so nothing changes visually. Default: off. Windows/Linux: toggle hidden.
- **Mascot and wordmark go mono.** The sidebar shows the hand glyph plus "Handy" in SF Pro Display instead of the bubbly wordmark, which clashed with the premium look. The mascot's pink tongue is neutral grey. Rejected: tinting them in the accent (it read as a different brand).
- **Active nav row = translucent `line` fill**, not `surface-2`. In light mode `surface-2` matched the canvas and the active row disappeared (caught in the first screenshot pass).

## Where it lives

- `src/styles/theme.css`: the palette (generated light/dark pairs, glass alphas)
- `src/App.css`: Tailwind token registration, SF Pro Display, `.title-display`, `.hairline-dashed`, `.panel-glow`, focus ring
- `src/App.tsx`: layout (full-height sidebar, content panel with large title + dashed rule, footer inside the panel)
- `src/components/Sidebar.tsx`: nav with drag region for the traffic lights
- `src/components/ui/{SettingsGroup,SettingContainer,Button,Switch}.tsx`: card, row, button, switch styling
- `src/lib/utils/glass.ts`: apply/persist the glass effect (boot-time from localStorage, then from settings)
- `src/components/settings/GlassEffectToggle.tsx`: the toggle (About → next to the theme)
- `src-tauri/src/settings.rs` (`glass_effect`), `src-tauri/src/shortcut/mod.rs` (`change_glass_effect_setting`), `src-tauri/src/lib.rs` (transparent window, overlay title bar)
- `src-tauri/src/glass.rs`: native Liquid Glass / vibrancy
- `src/overlay/RecordingOverlay.css`: the dark widget
- `src-tauri/capabilities/default.json`: `core:window:allow-start-dragging` (drag regions)

## How to test it

1. `bun run tauri dev`. The window shows a black (dark) or light-grey (light) sidebar, the traffic lights inside it, and a large page title.
2. Drag the window by the sidebar top or the page title.
3. About → Glass Effect on: the desktop blurs through the sidebar and panel. Off: opaque again. Restart: the choice persists without a flash.
4. Theme → Light / Dark / System: all three read well with glass on and off.
5. Record a dictation: the overlay pill is dark with an amber dot and glow, with no pink.
6. Smoke test: `bun run test:playwright` runs `tests/design.spec.ts`, which mocks the Tauri IPC, renders the settings UI in light, dark and dark+glass, fails on any of the old pinks in computed styles, and checks that the glass toggle sets `data-glass` and requests and clears the native effect. Screenshots land in `test-results/design/`.
7. Checks: `bunx tsc --noEmit`, `bun run lint`, `bun run format:check`, `bun run check:translations`, `bun run test:keyboard`.

## Limits & open items

- The app icon and the tray icons are still the original pink hand (`src-tauri/icons`, `src-tauri/resources/*.png`); they need new artwork.
- Bundle ID is still `com.pais.handy`.
- Non-English locales other than German show the English glass strings.
- The smoke test runs in Chromium, so it cannot show the real vibrancy; check that in the native app.

## History

- 2026-11-02: created
- 2026-11-02: review caught bare custom properties in color-mix() (status washes blank) and a glass toggle without rollback; fixed test-first (`fix:` commit).
- 2026-11-02: round 2: dark-first, toolbar title, dark widget, native Liquid Glass.
- 2026-11-02: round 3: accent blue → amber, as in Jonah's Profound screenshots.
- 2026-11-02: round 4 (Jonah: "pulsierender Gradient … Background, der leicht lebendig wirkt, wenn ich aufnehme"): the widget gets a drifting amber/ember gradient behind its content; its brightness follows the voice level (`--energy`, computed from the mic levels). The live text is upright, with tentative words dimmed, and cancel is a white disc like Profound's stop button. History entries are grey chat bubbles. Covered by `tests/overlay.spec.ts`, which drives the overlay with mocked show-overlay/recording-ready/mic-level events.
- 2026-11-02: native check: a 58% translucent content panel turned grey over the glass. Now only the sidebar is glass and the panel/cards stay nearly opaque (86%/92%), as in macOS 26 apps.
