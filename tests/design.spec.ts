import { test, expect, type Page } from "@playwright/test";

/**
 * Design smoke test: renders the real settings UI in Chromium with the Tauri
 * IPC mocked, so the layout, palette and glass toggle can be checked without
 * the native app. Screenshots land in test-results/design/ for eyeballing.
 */

const SETTINGS = {
  onboarding_completed: true,
  bindings: {
    transcribe: {
      id: "transcribe",
      name: "Transcribe",
      description: "Converts your speech into text.",
      default_binding: "option+space",
      current_binding: "option+space",
    },
    cancel: {
      id: "cancel",
      name: "Cancel",
      description: "Cancels the current recording.",
      default_binding: "escape",
      current_binding: "escape",
    },
  },
  push_to_talk: true,
  audio_feedback: true,
  audio_feedback_volume: 0.6,
  sound_theme: "marimba",
  selected_model: "",
  selected_language: "auto",
  spoken_languages: ["de", "en"],
  theme: "system",
  glass_effect: false,
  post_process_enabled: false,
  debug_mode: false,
  custom_words: [],
};

type Mode = { theme: "light" | "dark"; glass: boolean };

async function mockTauri(page: Page, mode: Mode) {
  await page.addInitScript(
    ({ settings, mode }) => {
      const state = {
        ...settings,
        glass_effect: mode.glass,
        theme: mode.theme,
      };
      const w = window as unknown as Record<string, unknown>;
      // Apply the stored choices the way main.tsx does on boot.
      localStorage.setItem("handy.theme", mode.theme);
      localStorage.setItem("handy.glass", mode.glass ? "1" : "0");
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
      const calls: string[] = [];
      w.__HANDY_IPC_CALLS__ = calls;
      let cb = 0;
      w.__TAURI_INTERNALS__ = {
        metadata: {
          currentWindow: { label: "main" },
          currentWebview: { windowLabel: "main", label: "main" },
        },
        transformCallback: () => ++cb,
        unregisterCallback: () => {},
        convertFileSrc: (p: string) => p,
        invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
          calls.push(cmd);
          if (cmd === "get_app_settings" || cmd === "get_default_settings")
            return state;
          if (cmd === "change_glass_effect_setting") {
            // A test can make the settings write fail to check the rollback.
            if (w.__HANDY_FAIL_GLASS_WRITE__) throw new Error("write failed");
            state.glass_effect = args.enabled as boolean;
            w.__HANDY_GLASS_WRITES__ = [
              ...((w.__HANDY_GLASS_WRITES__ as boolean[]) ?? []),
              args.enabled as boolean,
            ];
            return null;
          }
          if (cmd.startsWith("plugin:macos-permissions")) return true;
          if (cmd === "plugin:app|version") return "0.10.0";
          if (cmd.startsWith("plugin:event|listen")) return ++cb;
          if (
            /^(get|list).*(models|devices|languages|entries|notices|jobs|providers)/.test(
              cmd,
            )
          )
            return [];
          return null;
        },
      };
    },
    { settings: SETTINGS, mode },
  );
}

const PINK = ["rgb(250, 162, 202)", "rgb(242, 140, 187)", "rgb(218, 88, 147)"];

for (const mode of [
  { theme: "light", glass: false },
  { theme: "dark", glass: false },
  { theme: "dark", glass: true },
] as Mode[]) {
  const name = `${mode.theme}${mode.glass ? "-glass" : ""}`;

  test(`settings render in the premium palette (${name})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockTauri(page, mode);
    await page.setViewportSize({ width: 960, height: 680 });
    await page.goto("/");

    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      mode.theme,
    );
    if (mode.glass) {
      await expect(page.locator("html")).toHaveAttribute("data-glass", "on");
    } else {
      await expect(page.locator("html")).not.toHaveAttribute("data-glass");
    }

    // No pink anywhere in the computed styles.
    const pinkHits = await page.evaluate((pink) => {
      const hits: string[] = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const cs = getComputedStyle(el);
        for (const v of [cs.color, cs.backgroundColor, cs.borderColor, cs.fill])
          if (pink.some((p) => v.includes(p))) hits.push(el.tagName);
      }
      return hits;
    }, PINK);
    expect(pinkHits).toEqual([]);

    // Status tints must resolve to a real colour (warning/error/success boxes).
    const washes = await page.evaluate(() => {
      const probe = document.createElement("div");
      document.body.appendChild(probe);
      const out: Record<string, string> = {};
      for (const t of ["moss-wash", "warning-wash", "error-wash"]) {
        probe.style.backgroundColor = `var(--color-${t})`;
        out[t] = getComputedStyle(probe).backgroundColor;
      }
      probe.remove();
      return out;
    });
    for (const [token, value] of Object.entries(washes))
      expect(value, token).not.toBe("rgba(0, 0, 0, 0)");

    await page.screenshot({
      path: `test-results/design/${name}-general.png`,
    });
    await nav.getByRole("button").last().click();
    await expect(page.locator("main h1")).toBeVisible();
    await page.screenshot({ path: `test-results/design/${name}-about.png` });

    expect(errors).toEqual([]);
  });
}

const glassWrites = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __HANDY_GLASS_WRITES__?: boolean[] })
        .__HANDY_GLASS_WRITES__ ?? [],
  );

test("glass toggle switches the glass layer on and off", async ({ page }) => {
  await mockTauri(page, { theme: "dark", glass: false });
  await page.goto("/");
  await page.locator("nav").getByRole("button").last().click();

  const toggle = page.getByRole("checkbox", { name: /glass/i });
  await expect(toggle).not.toBeChecked();

  // On: the setting is saved (Rust applies Liquid Glass) and the floating
  // glass sidebar appears.
  await toggle.check({ force: true });
  await expect(page.locator("html")).toHaveAttribute("data-glass", "on");
  expect(await glassWrites(page)).toEqual([true]);
  await expect(page.locator("nav")).toHaveCSS("border-top-left-radius", "18px");

  // Off: saved as false, back to the opaque layout.
  await toggle.uncheck({ force: true });
  await expect(page.locator("html")).not.toHaveAttribute("data-glass");
  expect(await glassWrites(page)).toEqual([true, false]);
  await expect(page.locator("nav")).toHaveCSS("border-top-left-radius", "0px");
});

test("glass rolls back when the settings write fails", async ({ page }) => {
  await mockTauri(page, { theme: "dark", glass: false });
  await page.goto("/");
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__HANDY_FAIL_GLASS_WRITE__ =
      true;
  });
  await page.locator("nav").getByRole("button").last().click();

  const toggle = page.getByRole("checkbox", { name: /glass/i });
  // click, not check(): the switch is expected to snap back.
  await toggle.click({ force: true });

  // The write failed: the switch, the page and the boot cache fall back to off.
  await expect(toggle).not.toBeChecked();
  await expect(page.locator("html")).not.toHaveAttribute("data-glass");
  expect(await page.evaluate(() => localStorage.getItem("handy.glass"))).toBe(
    "0",
  );
});

test("reduce transparency makes the glass layers opaque", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
  });
  await mockTauri(page, { theme: "dark", glass: true });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-glass", "on");

  const nav = page.locator("nav");
  await expect(nav).toHaveCSS("backdrop-filter", "none");
  const navBg = await nav.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  // Opaque: rgb(...), rgba(..., 1) or color(srgb r g b) without an alpha part.
  expect(navBg).toMatch(/^rgb\(|, 1\)$|^color\(srgb [\d.]+ [\d.]+ [\d.]+\)$/);

  const card = page.locator(".glass-card").first();
  await expect(card).toHaveCSS("backdrop-filter", "none");
});
