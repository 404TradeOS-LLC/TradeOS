import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const backlogPath = path.join(repoRoot, "docs", "SPRINT_BACKLOG.md");
const handoffPath = path.join(repoRoot, "docs", "SESSION_HANDOFF.md");
const backlog = fs.readFileSync(backlogPath, "utf8");
const handoff = fs.readFileSync(handoffPath, "utf8");

const validStatuses = new Set(["DONE", "IN_REVIEW", "READY", "BLOCKED", "PLANNED", "DEFERRED", "CANCELLED"]);
const mergedPrs = new Set(["20", "21", "22", "23", "24", "25", "26", "27", "28", "29"]);

function sprintBlocks() {
  const matches = [...backlog.matchAll(/^### (S\d{3}) — (.+)$/gm)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? backlog.length;
    return { id: match[1], title: match[2], body: backlog.slice(start, end) };
  });
}

function field(block, name) {
  const match = block.body.match(new RegExp(`^${name}:\\s*(.*)$`, "m"));
  assert.ok(match, `${block.id} is missing ${name}`);
  return match[1].trim();
}

test("sprint backlog has exactly S001 through S050 once", () => {
  const ids = sprintBlocks().map((block) => block.id);
  const expected = Array.from({ length: 50 }, (_, index) => `S${String(index + 1).padStart(3, "0")}`);
  assert.deepEqual(ids, expected);
  assert.equal(new Set(ids).size, 50);
});

test("sprint statuses use only the allowed vocabulary", () => {
  for (const block of sprintBlocks()) {
    const status = field(block, "Status");
    assert.ok(validStatuses.has(status), `${block.id} has invalid status ${status}`);
  }
});

test("DONE sprints have merged evidence", () => {
  for (const block of sprintBlocks()) {
    if (field(block, "Status") !== "DONE") continue;
    assert.match(block.body, /Evidence:.*PR #\d+ merged/s, `${block.id} is DONE without merged PR evidence`);
  }
});

test("READY sprints do not overlap PR 27 or PR 30 and have eligible dependencies", () => {
  const statuses = new Map(sprintBlocks().map((block) => [block.id, field(block, "Status")]));
  for (const block of sprintBlocks()) {
    if (field(block, "Status") !== "READY") continue;
    assert.doesNotMatch(block.body, /PR #27|PR #30/, `${block.id} is READY but references PR #27 or PR #30`);
    const dependencies = field(block, "Dependencies");
    for (const sprintId of dependencies.match(/S\d{3}/g) ?? []) {
      assert.equal(statuses.get(sprintId), "DONE", `${block.id} is READY but dependency ${sprintId} is not DONE`);
    }
  }
});

test("PR 29 is recorded as merged and not recreated", () => {
  const aiSprint = sprintBlocks().find((block) => block.id === "S023");
  assert.ok(aiSprint, "missing S023");
  assert.equal(field(aiSprint, "Status"), "DONE");
  assert.match(aiSprint.body, /PR #29 merged as `10ec35e`/);
  const recreated = sprintBlocks().filter((block) => /AI Estimator engine hardening/.test(block.title) && block.id !== "S023");
  assert.deepEqual(recreated, []);
});

test("existing scheduling work is treated as merged baseline", () => {
  const schedulingSprint = sprintBlocks().find((block) => block.id === "S029");
  assert.ok(schedulingSprint, "missing S029");
  assert.equal(field(schedulingSprint, "Status"), "DONE");
  assert.match(schedulingSprint.body, /PR #20 merged/);
});

test("dependencies reference only valid sprint ids, merged PRs, or none", () => {
  const ids = new Set(sprintBlocks().map((block) => block.id));
  for (const block of sprintBlocks()) {
    const dependencies = field(block, "Dependencies");
    const withoutSprintIds = dependencies.replace(/S\d{3}/g, "");
    const withoutPrs = withoutSprintIds.replace(/PR #\d+( merged)?/g, "");
    const remainder = withoutPrs.replace(/none/g, "").replace(/,/g, "").trim();
    assert.equal(remainder, "", `${block.id} has non-mechanical dependency text: ${dependencies}`);
    for (const sprintId of dependencies.match(/S\d{3}/g) ?? []) {
      assert.ok(ids.has(sprintId), `${block.id} references unknown sprint dependency ${sprintId}`);
    }
    for (const pr of dependencies.match(/PR #(\d+)/g) ?? []) {
      const prNumber = pr.match(/\d+/)[0];
      assert.ok(mergedPrs.has(prNumber), `${block.id} references unmerged or unknown PR dependency ${pr}`);
    }
  }
});

test("first eligible READY sprint is mechanically selected", () => {
  const blocks = sprintBlocks();
  const statuses = new Map(blocks.map((block) => [block.id, field(block, "Status")]));
  const eligible = blocks.find((block) => {
    if (field(block, "Status") !== "READY") return false;
    const dependencies = field(block, "Dependencies");
    return (dependencies.match(/S\d{3}/g) ?? []).every((sprintId) => statuses.get(sprintId) === "DONE");
  });
  const nextEligibleSection = backlog.split("## Next Eligible Sprint")[1] ?? "";
  if (eligible) {
    assert.ok(
      nextEligibleSection.includes(eligible.id),
      `Next Eligible Sprint does not identify computed sprint ${eligible.id}`
    );
  } else {
    assert.match(nextEligibleSection, /No other sprint is\s+currently marked `READY`/);
  }
});

test("session handoff ends with a mechanical next-sprint resume contract", () => {
  const sectionMarker = "## Next Eligible Sprint";
  const sectionIndex = handoff.lastIndexOf(sectionMarker);
  assert.notEqual(sectionIndex, -1, "SESSION_HANDOFF is missing its terminal Next Eligible Sprint section");

  const resumeSection = handoff.slice(sectionIndex).trim();
  const fieldValue = (name) => {
    const match = resumeSection.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
    assert.ok(match, `SESSION_HANDOFF is missing ${name}`);
    return match[1].trim();
  };

  const blocks = sprintBlocks();
  const statuses = new Map(blocks.map((block) => [block.id, field(block, "Status")]));
  const eligible = blocks.find((block) => {
    if (field(block, "Status") !== "READY") return false;
    const dependencies = field(block, "Dependencies");
    return (dependencies.match(/S\\d{3}/g) ?? []).every((sprintId) => statuses.get(sprintId) === "DONE");
  });

  assert.equal(fieldValue("Sprint ID"), eligible?.id ?? "NONE");
  assert.ok(fieldValue("Eligibility").length > 0);
  assert.ok(fieldValue("Dependencies").length > 0);
  assert.ok(fieldValue("Overlap check").length > 0);
  assert.ok(fieldValue("Startup prompt").length > 0);

  const finalLine = handoff.trim().split("\n").at(-1);
  assert.match(finalLine, /^Startup prompt:\s*.+$/, "Startup prompt must be the final handoff line");
});
