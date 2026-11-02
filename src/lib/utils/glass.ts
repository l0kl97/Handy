import { commands } from "@/bindings";
import { platform } from "@tauri-apps/plugin-os";

/**
 * Glass effect (macOS only).
 *
 * The native material is Rust's job (src-tauri/src/glass.rs): Liquid Glass
 * (NSGlassEffectView) on macOS 26+, sidebar vibrancy before that. It is
 * applied at startup and whenever change_glass_effect_setting runs. This
 * module only drives the CSS side: `data-glass="on"` lowers the layer alphas
 * and turns on the floating glass sidebar (theme.css / App.css).
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
