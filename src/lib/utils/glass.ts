import { commands } from "@/bindings";
import { platform } from "@tauri-apps/plugin-os";
import { getCurrentWindow, Effect, EffectState } from "@tauri-apps/api/window";

/**
 * Glass effect (macOS only).
 *
 * The main window is created transparent on macOS (see lib.rs). With glass
 * off, CSS paints opaque layers and nothing changes visually. With glass on,
 * `data-glass="on"` lowers the layer alphas (theme.css) and the window gets
 * the native sidebar vibrancy material, so the desktop blurs through.
 *
 * Like the theme, the choice is mirrored to localStorage and applied before
 * React mounts, then reconciled with AppSettings (the source of truth).
 */

export const GLASS_STORAGE_KEY = "handy.glass";

export const glassSupported = (): boolean => {
  try {
    return platform() === "macos";
  } catch {
    return false;
  }
};

export const applyGlass = (enabled: boolean): void => {
  const on = enabled && glassSupported();
  const root = document.documentElement;
  if (on) {
    root.dataset.glass = "on";
  } else {
    delete root.dataset.glass;
  }

  try {
    localStorage.setItem(GLASS_STORAGE_KEY, on ? "1" : "0");
  } catch {
    // Settings still persist; this only costs a one-frame flash on boot.
  }

  if (!glassSupported()) return;
  const win = getCurrentWindow();
  const result = on
    ? win.setEffects({
        effects: [Effect.Sidebar],
        state: EffectState.FollowsWindowActiveState,
      })
    : win.clearEffects();
  result.catch((e) => console.warn("Failed to apply glass effect:", e));
};

export const getStoredGlass = (): boolean => {
  try {
    return localStorage.getItem(GLASS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const syncGlassFromSettings = async (): Promise<void> => {
  try {
    const result = await commands.getAppSettings();
    if (result.status === "ok") {
      applyGlass(result.data.glass_effect ?? false);
    }
  } catch (e) {
    console.warn("Failed to sync glass effect from settings:", e);
  }
};
