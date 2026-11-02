import React from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import RecordingOverlay from "./RecordingOverlay";
import {
  applyTheme,
  getStoredTheme,
  syncThemeFromSettings,
} from "@/lib/utils/theme";
import {
  applyGlass,
  getStoredGlass,
  syncGlassFromSettings,
} from "@/lib/utils/glass";
import type { Theme } from "@/bindings";
import "@/i18n";

// A separate webview from the settings window, so the overlay has to set
// `data-theme` on its own document: last-known theme before render (shared
// localStorage) to avoid a flash, reconcile with the persisted setting in case
// the overlay booted first, then follow live changes.
applyTheme(getStoredTheme());
syncThemeFromSettings();
listen<Theme>("theme-changed", (event) => applyTheme(event.payload));
// Same for the glass setting: the widget wears the glass material too.
applyGlass(getStoredGlass());
syncGlassFromSettings();
listen<{ setting: string; value: unknown }>("settings-changed", (event) => {
  if (event.payload?.setting === "glass_effect")
    applyGlass(event.payload.value === true);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RecordingOverlay />
  </React.StrictMode>,
);
