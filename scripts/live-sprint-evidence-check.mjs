import fs from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
if (!token || !repository) {
  throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
}
const [owner, repo] = repository.split("/");
const text = fs.readFileSync("docs/SPRINT_BACKLOG.md", "utf8");
const sprintPattern = /^### (S\d{3}) — ([^\n]+)\n([\s\S]*?)(?=^### S\d{3} — |\n## |\Z)/gm;

const checks = [];
let match;
while ((match = sprintPattern.exec(text)) !== null) {
  const [, id, title, body] = match;
  const status = body.match(/^Status:\s+([A-Z_]+)\s*$/m)?.[1];
  if (status !== "DONE") continue;
  const prNumber = body.match(/^Evidence:.*?PR #(\d+)/m)?.[1];
  if (!prNumber) throw new Error(`${id} is DONE but has no PR number in its Evidence field.`);
  checks.push({ id, title: title.trim(), prNumber: Number(prNumber) });
}

for (const check of checks) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${check.prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`${check.id}: GitHub PR #${check.prNumber} lookup failed (${response.status}).`);
  }
  const pr = await response.json();
  if (!pr.merged_at) {
    throw new Error(`${check.id}: Evidence PR #${check.prNumber} is not merged.`);
  }
  console.log(`${check.id}: PR #${check.prNumber} merged ${pr.merged_at}`);
}
console.log(`Verified live merge evidence for ${checks.length} DONE sprints.`);
