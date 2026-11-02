/**
 * Fork: notice new upstream Handy releases without installing them.
 *
 * This app is a fork, so the official updater must never run: it would replace
 * the fork with stock Handy. Instead we read upstream's latest release from
 * GitHub and, when it is newer than the version this fork is based on, show a
 * notice that links to the release notes. Bringing it in is a merge in the
 * fork's repo (see docs/features/upstream-updates.md).
 */

export const UPSTREAM_REPO = "cjpais/Handy";
const LATEST_URL = `https://api.github.com/repos/${UPSTREAM_REPO}/releases/latest`;
const TIMEOUT_MS = 8000;

export interface UpstreamRelease {
  version: string;
  url: string;
}

/** "v0.10.1" / "0.10.1-beta.2" → [0, 10, 1]; null when not a version. */
export const parseVersion = (raw: string): number[] | null => {
  const m = raw.trim().match(/^v?(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
};

/** True when `candidate` is a strictly newer release than `current`. */
export const isNewer = (candidate: string, current: string): boolean => {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
};

/**
 * Upstream's latest release, or null when it can't be read (offline, rate
 * limited, timeout). Errors are logged, never thrown: a failed check must not
 * disturb the app.
 */
export const fetchLatestUpstream = async (
  fetchImpl: typeof fetch = fetch,
): Promise<UpstreamRelease | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(LATEST_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`Upstream release check failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      tag_name?: unknown;
      html_url?: unknown;
    };
    if (typeof data.tag_name !== "string" || !parseVersion(data.tag_name)) {
      console.warn("Upstream release check: unexpected response");
      return null;
    }
    return {
      version: data.tag_name.replace(/^v/, ""),
      url:
        typeof data.html_url === "string" &&
        data.html_url.startsWith("https://github.com/")
          ? data.html_url
          : `https://github.com/${UPSTREAM_REPO}/releases/latest`,
    };
  } catch (e) {
    console.warn("Upstream release check failed:", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
};
