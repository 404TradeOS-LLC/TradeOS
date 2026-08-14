import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(dirname, "../../..");

describe("web auth proxy", () => {
  it("redirects unauthenticated requests before app routes render", () => {
    const proxySource = readFileSync(resolve(dirname, "proxy.ts"), "utf8");

    assert.match(proxySource, /const \{ data \} = await supabase\.auth\.getClaims\(\)/);
    assert.match(proxySource, /if \(!data\?\.claims\.sub\)/);
    assert.match(proxySource, /NextResponse\.redirect\(loginUrl\)/);
  });

  it("runs on every protected app route family", () => {
    const proxySource = readFileSync(resolve(root, "src/proxy.ts"), "utf8");

    for (const route of [
      "/athena/:path*",
      "/brand-studio/:path*",
      "/costbook/:path*",
      "/customers/:path*",
      "/dashboard/:path*",
      "/dispatch/:path*",
      "/finish-setup/:path*",
      "/portal/:path*",
      "/projects/:path*",
      "/settings/:path*",
    ]) {
      assert.ok(proxySource.includes(route));
    }
  });
});
