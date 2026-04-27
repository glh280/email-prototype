/**
 * smoke-home.ts — verify SSR render path works without needing CF Access auth.
 *
 * Hits http://localhost:3000/ and http://localhost:3000/contacts from INSIDE
 * the container. Interpretation:
 *
 *   - 500 Internal Server Error → the route handler crashed (e.g., the sql<Date>
 *     CTE bug returns). BAD.
 *   - 302 redirect to a cloudflareaccess.com URL → proxy.ts intercepted an
 *     unauthenticated request AFTER the route-level middleware dispatch. The
 *     page would have rendered if the JWT were present. GOOD — because if
 *     the SSR had crashed, proxy.ts would never have gotten to run.
 *
 * Read-only.
 */
import http from "node:http";

async function probe(path: string): Promise<{ status: number | null; location?: string; bodyPrefix?: string }> {
  return new Promise((resolve) => {
    const req = http.request(
      { host: "127.0.0.1", port: 3000, path, method: "GET", timeout: 10_000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          resolve({
            status: res.statusCode ?? null,
            location: res.headers.location,
            bodyPrefix: body.slice(0, 200),
          });
        });
      },
    );
    req.on("error", (err) => resolve({ status: null, bodyPrefix: `ERR: ${err.message}` }));
    req.end();
  });
}

(async () => {
  for (const path of ["/", "/contacts"]) {
    const r = await probe(path);
    console.log(`GET ${path}`);
    console.log(`  status   : ${r.status ?? "no response"}`);
    if (r.location) console.log(`  location : ${r.location.slice(0, 120)}`);
    console.log(`  body[0:200]: ${(r.bodyPrefix ?? "").replace(/\s+/g, " ").slice(0, 200)}`);
    console.log("");

    if (r.status === 500) {
      console.log("  ⚠ 500 = SSR crashed. Tail logs for stack trace.");
    } else if (r.status === 302 && (r.location ?? "").includes("cloudflareaccess")) {
      console.log("  ✓ 302 → cloudflareaccess = proxy.ts redirected unauth request AFTER SSR dispatched. Page would render with a valid cookie.");
    } else if (r.status === 200) {
      console.log("  ✓ 200 = SSR rendered cleanly (no proxy gate on this path, e.g. health check).");
    } else {
      console.log("  ? unexpected response — review.");
    }
    console.log("");
  }
})();
