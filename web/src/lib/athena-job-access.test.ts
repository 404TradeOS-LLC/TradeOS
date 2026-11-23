import assert from "node:assert/strict";
import test from "node:test";

import { canReviewAthenaApprovals, canUseJobAthena } from "./athena-job-access.ts";

test("canUseJobAthena grants owner, admin, and dispatcher for any job", () => {
  for (const role of ["owner", "admin", "dispatcher"]) {
    assert.deepEqual(canUseJobAthena(role, "user-1", []), { granted: true, reason: "granted" });
    assert.deepEqual(canUseJobAthena(role, undefined, ["user-9"]), { granted: true, reason: "granted" });
  }
});

test("canUseJobAthena grants a technician only when assigned to the job", () => {
  assert.deepEqual(canUseJobAthena("technician", "tech-1", ["tech-1", "tech-2"]), {
    granted: true,
    reason: "granted",
  });
  assert.deepEqual(canUseJobAthena("technician", "tech-1", ["tech-2"]), {
    granted: false,
    reason: "technician_not_assigned",
  });
  assert.deepEqual(canUseJobAthena("technician", "tech-1", []), {
    granted: false,
    reason: "technician_not_assigned",
  });
});

test("canUseJobAthena denies a technician with no resolvable user id", () => {
  assert.deepEqual(canUseJobAthena("technician", undefined, ["tech-1"]), {
    granted: false,
    reason: "technician_not_assigned",
  });
  assert.deepEqual(canUseJobAthena("technician", null, ["tech-1"]), {
    granted: false,
    reason: "technician_not_assigned",
  });
  assert.deepEqual(canUseJobAthena("technician", "", ["tech-1"]), {
    granted: false,
    reason: "technician_not_assigned",
  });
});

test("canUseJobAthena denies viewer and unknown roles", () => {
  for (const role of ["viewer", "auditor", "", undefined, null]) {
    assert.deepEqual(canUseJobAthena(role, "user-1", ["user-1"]), {
      granted: false,
      reason: "role_not_permitted",
    });
  }
});

test("canReviewAthenaApprovals is owner/admin only", () => {
  assert.equal(canReviewAthenaApprovals("owner"), true);
  assert.equal(canReviewAthenaApprovals("admin"), true);
  for (const role of ["dispatcher", "technician", "viewer", "", undefined, null]) {
    assert.equal(canReviewAthenaApprovals(role), false);
  }
});
