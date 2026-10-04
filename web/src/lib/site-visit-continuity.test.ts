import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSiteVisitCaptureHref,
  canCaptureSiteVisit,
  firstSiteVisitSearchParam,
  resolveSiteVisitJob,
} from "./site-visit-continuity.ts";

const jobs = [
  { id: "job-open", archivedAt: null, title: "Open" },
  { id: "job-archived", archivedAt: "2026-10-04T00:00:00.000Z", title: "Archived" },
];

test("site visit job selection uses the first explicit parameter and only resolves unarchived project jobs", () => {
  assert.equal(firstSiteVisitSearchParam(["job-open", "job-other"]), "job-open");
  assert.equal(resolveSiteVisitJob(jobs, "job-open")?.title, "Open");
  assert.equal(resolveSiteVisitJob(jobs, "job-archived"), null);
  assert.equal(resolveSiteVisitJob(jobs, "foreign-job"), null);
  assert.equal(resolveSiteVisitJob(jobs, undefined), null);
});

test("site visit capture write controls preserve the existing crm.write role boundary", () => {
  assert.equal(canCaptureSiteVisit("owner"), true);
  assert.equal(canCaptureSiteVisit("admin"), true);
  assert.equal(canCaptureSiteVisit("dispatcher"), true);
  assert.equal(canCaptureSiteVisit("technician"), false);
  assert.equal(canCaptureSiteVisit("viewer"), false);
});

test("site visit capture href keeps project and job context explicit", () => {
  assert.equal(
    buildSiteVisitCaptureHref("project/unsafe", "job?unsafe"),
    "/projects/project%2Funsafe/intake?job=job%3Funsafe"
  );
});
