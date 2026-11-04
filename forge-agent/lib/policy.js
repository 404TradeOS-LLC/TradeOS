export const REPO = "404TradeOS-LLC/TradeOS";
export const READY_LABEL = "forge:ready";
const FULL_SHA = /^[a-f0-9]{40}$/;

export function validateDraft({ issueNumber, baseSha, files } = {}) {
  if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) throw Error("Invalid issue number");
  if (typeof baseSha !== "string" || !FULL_SHA.test(baseSha)) throw Error("Exact 40-digit main SHA required");
  if (!Array.isArray(files) || files.length < 1 || files.length > 4) throw Error("Invalid bounded file count");
  const seen = new Set();
  let total = 0;
  const bounded = files.map((f) => {
    if (typeof f?.path !== "string" || typeof f?.content !== "string") throw Error("Invalid file input");
    const parts = f.path.split("/");
    if (parts[0] !== "docs" || parts[1] !== "forge" || !f.path.endsWith(".md") ||
      parts.length < 3 || parts.some((p) => !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(p) || p === "..") ||
      f.path.includes("..") || f.path.includes("\\") || f.path.includes("%")) {
      throw Error("Pilot is limited to docs/forge Markdown");
    }
    if (!f.content.trim() || seen.has(f.path)) throw Error("Empty or duplicate file");
    seen.add(f.path);
    total += Buffer.byteLength(f.content, "utf8");
    return { path: f.path, content: f.content };
  });
  if (total > 48 * 1024) throw Error("Pilot files exceed 48 KiB");
  return {
    issueNumber, baseSha, files: bounded,
    branch: "forge/issue-" + issueNumber + "-" + baseSha.slice(0, 12),
  };
}
