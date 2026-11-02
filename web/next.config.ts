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
    // A 6 MiB receipt is carried in multipart FormData along with job fields.
    // Keep a narrow request cap above the max file size to allow framing overhead.
    // Server actions still validate the file contents, actor and tenant scope.
    serverActions: {
      bodySizeLimit: "7mb",
    },
  },
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
