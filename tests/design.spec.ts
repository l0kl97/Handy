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
  update_checks_enabled: true,
  debug_mode: false,
  custom_words: [],
};

type Mode = { theme: "light" | "dark"; glass: boolean };

async function mockTauri(page: Page, mode: Mode, upstream = "v0.10.0") {
  // Never hit the real GitHub API from tests.
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({
      json: {
        tag_name: upstream,
        html_url: `https://github.com/cjpais/Handy/releases/tag/${upstream}`,
      },
    }),
  );
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
          if (cmd === "get_history_entries") {
            const now = Math.floor(Date.now() / 1000);
            const entry = (id: number, ago: number, text: string) => ({
              id,
              file_name: `handy-${id}.wav`,
              timestamp: now - ago,
              saved: false,
              title: "",
              transcription_text: text,
              post_processed_text: null,
              post_process_prompt: null,
              post_process_requested: false,
              source_name: null,
              language: "de",
              language_source: "selected",
            });
            return {
              entries: [
                entry(
                  3,
                  120,
                  "Kannst du mir bis morgen das Angebot für Wrenfield schicken?",
                ),
                entry(2, 3600, "git commit -m 'fix the overlay width'"),
                entry(1, 7200, "Notiz ohne bekannte App."),
              ],
              has_more: false,
            };
          }
          if (cmd === "get_dictation_apps") {
            if (w.__HANDY_FAIL_APPS__) throw new Error("db locked");
            return [
              { history_id: 3, app_name: "Slack" },
              { history_id: 2, app_name: "Terminal" },
            ];
          }
          if (cmd === "get_dictation_stats") {
            if (w.__HANDY_FAIL_STATS__) throw new Error("db locked");
            // A believable week: ~1,900 words, most of them today.
            const day = 86400;
            const t = Math.floor(Date.now() / 1000) - 60;
            return [
              { timestamp: t - 6 * day, words: 180 },
              { timestamp: t - 4 * day, words: 320 },
              { timestamp: t - 3 * day, words: 95 },
              { timestamp: t - 2 * day, words: 410 },
              { timestamp: t - 1 * day, words: 260 },
              { timestamp: t - 300, words: 420 },
              { timestamp: t, words: 240 },
            ];
          }
          if (cmd.startsWith("plugin:macos-permissions")) return true;
          if (cmd === "plugin:app|version") return "0.10.0";
          if (cmd === "is_update_checks_locked") return false;
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

test("insights show time saved, tiles and the week", async ({ page }) => {
  await mockTauri(page, { theme: "dark", glass: false });
  await page.setViewportSize({ width: 960, height: 760 });
  await page.goto("/");

  // Insights is the landing page.
  const gauge = page.getByRole("img", { name: /saved this week/i });
  await expect(gauge).toBeVisible();
  // 1,925 words this week → 1925/40 − 1925/150 ≈ 35 minutes.
  await expect(gauge).toHaveAttribute("aria-label", /^35 min/);
  await expect(page.getByText("1,925", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(7);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: "test-results/design/insights-dark.png" });
});

test("insights report a failed load instead of breaking", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__HANDY_FAIL_STATS__ = true;
  });
  await mockTauri(page, { theme: "dark", glass: false });
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  // Still renders an empty gauge rather than nothing.
  await expect(
    page.getByRole("img", { name: /saved this week/i }),
  ).toBeVisible();
});

test("history shows the app each dictation went to", async ({ page }) => {
  await mockTauri(page, { theme: "dark", glass: false });
  await page.setViewportSize({ width: 960, height: 680 });
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "History" }).click();

  await expect(page.getByText("Kannst du mir bis morgen")).toBeVisible();
  await expect(page.getByTitle("Dictated into Slack")).toBeVisible();
  await expect(page.getByTitle("Dictated into Terminal")).toBeVisible();
  // An entry without a known app shows no pill.
  await expect(page.getByTitle(/Dictated into/)).toHaveCount(2);
  await page.screenshot({ path: "test-results/design/history-apps.png" });
});

test("history still renders when the app context fails", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__HANDY_FAIL_APPS__ = true;
  });
  await mockTauri(page, { theme: "dark", glass: false });
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "History" }).click();
  await expect(page.getByText("Kannst du mir bis morgen")).toBeVisible();
  await expect(page.getByTitle(/Dictated into/)).toHaveCount(0);
});

test("footer announces a newer upstream Handy without installing", async ({
  page,
}) => {
  await mockTauri(page, { theme: "dark", glass: false }, "v0.11.0");
  await page.goto("/");
  const notice = page.getByRole("button", { name: "Handy 0.11.0 available" });
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute("title", /not installed directly/);
});

test("footer stays quiet when upstream is not newer", async ({ page }) => {
  await mockTauri(page, { theme: "dark", glass: false }, "v0.10.0");
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Check for updates" }),
  ).toBeVisible();
  await expect(page.getByText(/available$/)).toHaveCount(0);
});

test("typing speed changes the time saved and shows the math", async ({
  page,
}) => {
  await mockTauri(page, { theme: "dark", glass: false });
  await page.goto("/");
  const gauge = page.getByRole("img", { name: /saved this week/i });
  await expect(gauge).toHaveAttribute("aria-label", /^35 min/);
  // 1,925 words: typing at 40 wpm ≈ 48.1 min, speaking ≈ 12.8 min.
  await expect(page.getByText(/1,925 words: typing ≈ 48\.1 min/)).toBeVisible();

  // A faster typist: 1925/80 − 1925/150 ≈ 11 minutes saved.
  await page.getByLabel("Your typing speed").selectOption("80");
  await expect(gauge).toHaveAttribute("aria-label", /^11 min/);
  // Remembered for next time.
  await page.reload();
  await expect(page.getByLabel("Your typing speed")).toHaveValue("80");
});

test("a group heading never repeats the page title", async ({ page }) => {
  await mockTauri(page, { theme: "dark", glass: false });
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "About" }).click();
  await expect(page.locator("main h1")).toHaveText("About");
  await expect(
    page.getByRole("heading", { name: "About", exact: true }),
  ).toHaveCount(1);
});

test("every page renders without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockTauri(page, { theme: "dark", glass: false });
  await page.setViewportSize({ width: 1040, height: 760 });
  await page.goto("/");
  const buttons = page.locator("nav").getByRole("button");
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const name = (await buttons.nth(i).innerText()).trim();
    await buttons.nth(i).click();
    await expect(page.locator("main h1")).toHaveText(name);
    await page.waitForTimeout(150);
    await page.screenshot({
      path: `test-results/pages/${i}-${name.toLowerCase()}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
