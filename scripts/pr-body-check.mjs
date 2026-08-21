#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const REQUIRED_PR_SECTIONS = [
  "Summary",
  "Scope",
  "Required Startup Verification",
  "Change Checklist",
  "Documentation Impact",
  "Verification",
  "Environment-Blocked Checks",
  "Risk Review",
  "Known Limitations",
  "Follow-Up Work",
];

function sectionPattern(title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+${escaped}\\s*$`, "mi");
}

function extractSection(body, title) {
  const heading = sectionPattern(title);
  const match = heading.exec(body);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const next = /^##\s+/m.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

function removeHtmlComments(value) {
  let cursor = 0;
  let visible = "";

  while (cursor < value.length) {
    const commentStart = value.indexOf("<!--", cursor);
    if (commentStart === -1) {
      visible += value.slice(cursor);
      break;
    }

    visible += value.slice(cursor, commentStart);
    const commentEnd = value.indexOf("-->", commentStart + 4);
    if (commentEnd === -1) break;
    cursor = commentEnd + 3;
  }

  return visible.trim();
}

export function validatePrBody(body) {
  const text = typeof body === "string" ? body : "";
  const visibleText = removeHtmlComments(text);
  const missingSections = REQUIRED_PR_SECTIONS.filter((title) => !sectionPattern(title).test(visibleText));
  const summary = extractSection(visibleText, "Summary");
  const summaryMissing = summary == null || summary === "";

  return {
    ok: missingSections.length === 0 && !summaryMissing,
    missingSections,
    summaryMissing,
  };
}

export function formatPrBodyFailure(result) {
  const problems = [];
  if (result.missingSections.length > 0) {
    problems.push(`missing sections: ${result.missingSections.join(", ")}`);
  }
  if (result.summaryMissing) problems.push("Summary is empty or contains only template comments");
  return `PR description does not satisfy the repository template: ${problems.join("; ")}`;
}

function readPullRequestBody(eventPath = process.env.GITHUB_EVENT_PATH) {
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is not set");
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  if (!event.pull_request) return null;
  return event.pull_request.body ?? "";
}

function main() {
  const body = readPullRequestBody();
  if (body == null) {
    console.log("No pull_request payload; PR body validation skipped.");
    return;
  }

  const result = validatePrBody(body);
  if (!result.ok) throw new Error(formatPrBodyFailure(result));
  console.log("PR description contains every required template section and a non-empty Summary.");
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
