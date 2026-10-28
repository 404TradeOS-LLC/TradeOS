import assert from "node:assert/strict";
import test from "node:test";
import {
  loadDashboardProjectDetails,
  loadDashboardStartup,
  resolveDashboardOrganizationContext,
} from "./dashboard-startup.ts";

// Legacy startup helpers remain available to other dashboard consumers.
test("organization settings failure preserves successfully loaded project data", async () => {
  const projects = [{ id: "project-1", name: "Test Project" }];
  let settingsCalls = 0;

  const result = await loadDashboardStartup("mock-token", {
    listProjects: async () => projects,
    getOrganizationSettings: async () => {
      settingsCalls += 1;
      throw new Error("Organization settings request failed");
    },
  });

  assert.deepEqual(result.projects, projects);
  assert.equal(result.settingsResponse, null);
  assert.equal(settingsCalls, 1);
});

test("one failed project detail preserves fulfilled project siblings", async () => {
  const projects = [{ id: "project-1" }, { id: "project-2" }, { id: "project-3" }];

  const result = await loadDashboardProjectDetails("mock-token", projects, 3, async (_token, projectId) => {
    if (projectId === "project-2") throw new Error("Project detail request failed");
    return { id: projectId, name: `Project ${projectId}` };
  });

  assert.deepEqual(
    result.items.map((project) => project.id),
    ["project-1", "project-3"],
  );
  assert.equal(result.failedCount, 1);
});

test("settings outage uses dispatch timezone and does not expose demo organization identity", () => {
  assert.deepEqual(resolveDashboardOrganizationContext(null, "America/Chicago"), {
    companyName: "Organization unavailable",
    timeZone: "America/Chicago",
  });
});
