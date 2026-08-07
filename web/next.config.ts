import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // web/src/domain re-exports app/domain (the shared canonical role/status
  // contracts), which lives outside this Next.js project's directory.
  // Turbopack does not honor experimental.externalDir (that flag only
  // affects the webpack build path) — it can only resolve modules that are
  // within turbopack.root, so root is pointed at the repo root (the nearest
  // ancestor containing both app/ and web/) rather than left to Next.js's
  // own auto-inference, which lands on the same directory anyway but emits
  // a "multiple lockfiles" warning because of the unrelated lockfile for
  // the repo root's docs-governance tooling package.
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
