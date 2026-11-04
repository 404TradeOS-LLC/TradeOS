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
    // A 4 MiB file is carried in multipart FormData along with job fields:
    // expense receipts and validated private brand images alike. Keep a
    // narrow request cap above the max file size to allow framing overhead,
    // while staying below the hosted function request limit. Server actions
    // still validate the file contents, actor and tenant scope.
    serverActions: {
      bodySizeLimit: "4.25mb",
    },
  },
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
