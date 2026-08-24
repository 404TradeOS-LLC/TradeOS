import fs from "node:fs";

const backlogPath = process.argv[2] || "docs/SPRINT_BACKLOG.md";
const text = fs.readFileSync(backlogPath, "utf8");
const allowed = new Set(["DONE", "IN_REVIEW", "READY", "BLOCKED", "PLANNED", "DEFERRED", "CANCELLED"]);

const sprintPattern = /^### (S\d{3}) — ([^\n]+)\n([\s\S]*?)(?=^### S\d{3} — |\n## |\Z)/gm;
const sprints = new Map();
let match;
while ((match = sprintPattern.exec(text)) !== null) {
  const [, id, title, body] = match;
  const status = body.match(/^Status:\s+([A-Z_]+)\s*$/m)?.[1];
  const depsRaw = body.match(/^Dependencies:\s+(.+)\s*$/m)?.[1] ?? "none";
  const dependencies = depsRaw === "none"
    ? []
    : depsRaw.split(",").map((value) => value.trim()).filter(Boolean);
  sprints.set(id, { id, title: title.trim(), status, dependencies, body });
}

const errors = [];
if (sprints.size !== 50) {
  errors.push(`Expected 50 numbered sprints, found ${sprints.size}.`);
}

for (const sprint of sprints.values()) {
  if (!allowed.has(sprint.status)) {
    errors.push(`${sprint.id} has invalid or missing status: ${sprint.status ?? "<missing>"}.`);
  }
  for (const dep of sprint.dependencies) {
    if (!sprints.has(dep)) {
      errors.push(`${sprint.id} depends on unknown sprint ${dep}.`);
    }
  }
}

const ready = [...sprints.values()].filter((sprint) => sprint.status === "READY");
if (ready.length > 1) {
  errors.push(`At most one numbered sprint may be READY; found ${ready.map((s) => s.id).join(", ")}.`);
}

for (const sprint of ready) {
  for (const dep of sprint.dependencies) {
    if (sprints.get(dep)?.status !== "DONE") {
      errors.push(`${sprint.id} is READY but dependency ${dep} is ${sprints.get(dep)?.status ?? "missing"}, not DONE.`);
    }
  }
  if (/Founder decision required:\s*YES/i.test(sprint.body)) {
    errors.push(`${sprint.id} is READY while its record still says Founder decision required: YES.`);
  }
  if (/Blocked by:/i.test(sprint.body)) {
    errors.push(`${sprint.id} is READY while its record still contains a Blocked by field.`);
  }
}

for (const sprint of sprints.values()) {
  if (sprint.status === "DONE" && !/^Evidence:/m.test(sprint.body)) {
    errors.push(`${sprint.id} is DONE without an Evidence field.`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated ${sprints.size} sprints; READY=${ready.map((s) => s.id).join(",") || "NONE"}.`);
