// Run with: bun src/lib/updates/upstream.test.ts
import { fetchLatestUpstream, isNewer, parseVersion } from "./upstream";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) {
    failures++;
    console.error(`✗ ${name}`, detail ?? "");
  }
};

// Version parsing and comparison
check(
  "parse v-prefixed",
  JSON.stringify(parseVersion("v0.10.1")) === "[0,10,1]",
);
check("parse two parts", JSON.stringify(parseVersion("1.2")) === "[1,2,0]");
check("parse garbage", parseVersion("nightly") === null);
check("patch newer", isNewer("v0.10.1", "0.10.0"));
check("minor newer", isNewer("0.11.0", "0.10.9"));
check("major newer", isNewer("1.0.0", "0.99.99"));
check("same is not newer", !isNewer("v0.10.0", "0.10.0"));
check("older is not newer", !isNewer("0.9.9", "0.10.0"));
check("10 > 9 numerically", isNewer("0.10.0", "0.9.0"));
check("garbage is never newer", !isNewer("latest", "0.10.0"));

const respond = (status: number, body: unknown) =>
  (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

(async () => {
  const ok = await fetchLatestUpstream(
    respond(200, {
      tag_name: "v0.11.0",
      html_url: "https://github.com/cjpais/Handy/releases/tag/v0.11.0",
    }),
  );
  check(
    "reads tag and url",
    ok?.version === "0.11.0" && ok.url.endsWith("v0.11.0"),
    ok,
  );

  const foreign = await fetchLatestUpstream(
    respond(200, { tag_name: "v0.11.0", html_url: "https://evil.example/x" }),
  );
  check(
    "never links outside github.com",
    foreign?.url === "https://github.com/cjpais/Handy/releases/latest",
    foreign,
  );

  check(
    "HTTP error → null",
    (await fetchLatestUpstream(respond(403, {}))) === null,
  );
  check(
    "unexpected body → null",
    (await fetchLatestUpstream(respond(200, { tag_name: 42 }))) === null,
  );
  const offline = (async () => {
    throw new TypeError("Failed to fetch");
  }) as unknown as typeof fetch;
  check("network error → null", (await fetchLatestUpstream(offline)) === null);

  if (failures > 0) {
    console.error(`upstream: ${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("upstream: all assertions passed");
})();
