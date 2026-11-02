import { test, expect, type Page } from "@playwright/test";

test.use({ deviceScaleFactor: 2 });

/**
 * Recording widget smoke test: renders the overlay window in Chromium with the
 * Tauri IPC mocked and drives it with the same events Rust sends (show-overlay,
 * recording-ready, mic-level). Screenshots land in test-results/overlay/.
 */

async function mockOverlay(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__TAURI_OS_PLUGIN_INTERNALS__ = {
      platform: "macos",
      os_type: "macos",
      family: "unix",
      arch: "aarch64",
      version: "26.0",
      eol: "\n",
      exe_extension: "",
    };
    w.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    const callbacks = new Map<number, (e: unknown) => void>();
    const handlers = new Map<string, number[]>();
    let next = 0;
    w.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "recording_overlay" },
        currentWebview: {
          windowLabel: "recording_overlay",
          label: "recording_overlay",
        },
      },
      transformCallback: (cb: (e: unknown) => void) => {
        const id = ++next;
        callbacks.set(id, cb);
        return id;
      },
      unregisterCallback: (id: number) => callbacks.delete(id),
      convertFileSrc: (p: string) => p,
      invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
        if (cmd === "plugin:event|listen") {
          const name = args.event as string;
          handlers.set(name, [
            ...(handlers.get(name) ?? []),
            args.handler as number,
          ]);
          return args.handler;
        }
        if (cmd === "get_app_settings")
          return { overlay_position: "bottom", app_language: "de" };
        return null;
      },
    };
    // Test hook: deliver an event the way Tauri does.
    w.__emit = (event: string, payload: unknown) => {
      for (const id of handlers.get(event) ?? [])
        callbacks.get(id)?.({ event, id, payload });
    };
  });
}

const emit = (page: Page, event: string, payload: unknown = null) =>
  page.evaluate(
    ([e, p]) =>
      (window as unknown as { __emit: (e: string, p: unknown) => void }).__emit(
        e as string,
        p,
      ),
    [event, payload] as const,
  );

// A plausible voice spectrum: energy in the low buckets.
const voice = (gain: number) =>
  Array.from({ length: 16 }, (_, i) => Math.max(0, gain - i * 0.04));

async function stage(page: Page) {
  await page.setViewportSize({ width: 400, height: 140 });
  await page.goto("/src/overlay/index.html");
  // A dark desktop behind the transparent overlay window.
  await page.addStyleTag({
    content:
      "html{background:radial-gradient(120% 140% at 20% 0%,#2a2d3a,#0b0b0d)!important}",
  });
}

test("widget: quiet, speaking and live text", async ({ page }) => {
  await mockOverlay(page);
  await stage(page);

  await emit(page, "show-overlay", "recording");
  await emit(page, "recording-ready");
  const card = page.locator(".scard");
  await expect(card).toBeVisible();
  await expect(card).toHaveClass(/live/);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/overlay/1-quiet.png" });

  for (let i = 0; i < 12; i++) await emit(page, "mic-level", voice(0.85));
  await page.waitForTimeout(250);
  const energy = await card.evaluate((el) =>
    parseFloat(getComputedStyle(el).getPropertyValue("--energy")),
  );
  expect(energy).toBeGreaterThan(0.4);
  await page.screenshot({ path: "test-results/overlay/2-speaking.png" });

  // Working state: no living background.
  await emit(page, "show-overlay", "transcribing");
  await expect(card).not.toHaveClass(/live/);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/overlay/3-transcribing.png" });
});

test("widget: live streaming panel", async ({ page }) => {
  await mockOverlay(page);
  await stage(page);
  await emit(page, "show-overlay", "streaming");
  await emit(page, "recording-ready");
  await emit(page, "stream-text-event", {
    committed: "Kurze Notiz an Rebecca: Ich bin gegen sieben zu Hause und",
    tentative: " bringe Brot mit",
  });
  for (let i = 0; i < 12; i++) await emit(page, "mic-level", voice(0.7));
  await page.waitForTimeout(600);
  await expect(page.locator(".scard.open")).toBeVisible();
  await page.screenshot({ path: "test-results/overlay/4-live.png" });
});

test("widget stays light-on-dark under the Light theme", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("handy.theme", "light"));
  await mockOverlay(page);
  await stage(page);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await emit(page, "show-overlay", "streaming");
  await emit(page, "recording-ready");
  await emit(page, "stream-text-event", {
    committed: "Lesbar auch im hellen Theme",
    tentative: "",
  });
  const text = page.locator(".stext-cap .committed");
  await expect(text).toBeVisible();
  // #f5f5f7, the widget ink, not the light theme's near-black text.
  await expect(text).toHaveCSS("color", "rgb(245, 245, 247)");
  await page.screenshot({ path: "test-results/overlay/5-light-theme.png" });
});
