import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPrFiles,
  detectStacks,
  isArmed,
  nextRetryDelayMs,
  orderMerges,
} from "../pr-commander-lib.mjs";

// Tests for PR Commander merge ordering, stack detection, retry/backoff,
// dry-run arming, and file classification (Workstream C).
//
// Contract under test (Workstream B builds `scripts/pr-commander-lib.mjs`):
//   orderMerges(prs) -> ordered array, dependency-safe
//   detectStacks(prs) -> groups of stacked PRs
//   nextRetryDelayMs(attempt) -> ms; ~60s, ~120s, ~240s; no retry after 3
//   isArmed(env) -> boolean, true ONLY when the env value is exactly "true"
//   classifyPrFiles(files) -> { migrations, rls, auth, protectedStaging, other }
//
// Assumptions the brief leaves unspecified (flagged for the coordinator if
// the lib disagrees — these tests assert the contract as written):
//   - A PR's own branch is `headRefName` (the GitHub GraphQL name matching
//     `baseRefName`); a stack link is baseRefName === another PR's headRefName.
//   - orderMerges reports a dependency cycle by throwing an Error naming the
//     cycle, rather than silently returning an ordering for it.
//   - detectStacks returns groups (arrays) of PRs; a group is a chain ordered
//     base-first. Independent PRs never appear in a multi-PR group.
//   - isArmed reads an env mapping; the brief names no key, so the arming
//     fixtures set every plausible key (PR_COMMANDER_ARMED,
//     PR_COMMANDER_ENABLED, COMMANDER_ARMED) to the same value and the
//     canonical key must be one of them.
//   - classifyPrFiles takes plain path strings and returns booleans; `other`
//     is true exactly when at least one file falls in no protected category.

const HEAD = "a".repeat(40);

function pr(number, headRefName, baseRefName) {
  return { number, headRefName, baseRefName, headSha: HEAD, isDraft: false };
}

// #945 (pilot) -> #960 (registry) -> #961 (parcel matching) -> #962 (permit tasks)
const CHAIN = [
  pr(945, "feat/945-pilot", "main"),
  pr(960, "feat/960-registry", "feat/945-pilot"),
  pr(961, "feat/961-parcel-matching", "feat/960-registry"),
  pr(962, "feat/962-permit-tasks", "feat/961-parcel-matching"),
];

function numbers(ordered) {
  return ordered.map((item) => (typeof item === "number" ? item : item.number));
}

function indexOf(numbersArray, number) {
  const index = numbersArray.indexOf(number);
  assert.notEqual(index, -1, `expected PR #${number} in ${JSON.stringify(numbersArray)}`);
  return index;
}

// --- Merge ordering -------------------------------------------------------

test("stacked chain orders base-before-dependent regardless of input order", () => {
  const ordered = orderMerges([CHAIN[3], CHAIN[1], CHAIN[0], CHAIN[2]]);
  assert.deepEqual(numbers(ordered), [945, 960, 961, 962]);
});

test("independent PRs keep their input order", () => {
  const input = [pr(100, "feat/100-a", "main"), pr(101, "feat/101-b", "main"), pr(102, "feat/102-c", "main")];
  assert.deepEqual(numbers(orderMerges(input)), [100, 101, 102]);
});

test("mixed input preserves independent order and keeps every dependency before its dependent", () => {
  const input = [CHAIN[3], pr(100, "feat/100-a", "main"), CHAIN[0], CHAIN[2], pr(101, "feat/101-b", "main"), CHAIN[1]];
  const ordered = numbers(orderMerges(input));
  assert.deepEqual([...ordered].sort((a, b) => a - b), [100, 101, 945, 960, 961, 962]);
  assert.ok(indexOf(ordered, 100) < indexOf(ordered, 101), "independent PRs keep input order");
  assert.ok(indexOf(ordered, 945) < indexOf(ordered, 960));
  assert.ok(indexOf(ordered, 960) < indexOf(ordered, 961));
  assert.ok(indexOf(ordered, 961) < indexOf(ordered, 962));
});

test("orderMerges does not mutate its input", () => {
  const input = [CHAIN[3], CHAIN[0], CHAIN[1]];
  const before = numbers(input);
  orderMerges(input);
  assert.deepEqual(numbers(input), before);
});

test("a single PR orders to itself and an empty list orders to empty", () => {
  assert.deepEqual(numbers(orderMerges([CHAIN[0]])), [945]);
  assert.deepEqual(orderMerges([]), []);
});

test("a dependency cycle is reported as BLOCKED, not silently ordered", () => {
  const cycle = [
    pr(200, "feat/200-a", "feat/201-b"),
    pr(201, "feat/201-b", "feat/200-a"),
  ];
  assert.throws(() => orderMerges(cycle), /cycle|BLOCKED/i);
});

// --- Stack detection ------------------------------------------------------

test("detectStacks finds the #960-on-#945 chain from baseRefName linkage", () => {
  const groups = detectStacks([...CHAIN].reverse());
  assert.ok(Array.isArray(groups));
  const chainGroup = groups.find((group) => numbers(group).includes(945));
  assert.ok(chainGroup, "expected a group containing #945");
  assert.deepEqual(numbers(chainGroup), [945, 960, 961, 962]);
});

test("detectStacks does not group independent PRs", () => {
  const independents = [pr(100, "feat/100-a", "main"), pr(101, "feat/101-b", "main")];
  const groups = detectStacks([...CHAIN, ...independents]);
  for (const group of groups) {
    if (numbers(group).length > 1) {
      assert.ok(!numbers(group).includes(100), "independent #100 must not be in a stack");
      assert.ok(!numbers(group).includes(101), "independent #101 must not be in a stack");
    }
  }
});

test("detectStacks on all-independent PRs yields no multi-PR group", () => {
  const groups = detectStacks([
    pr(100, "feat/100-a", "main"),
    pr(101, "feat/101-b", "main"),
    pr(102, "feat/102-c", "main"),
  ]);
  assert.ok(groups.every((group) => numbers(group).length < 2));
});

test("detectStacks separates two unrelated chains into two groups", () => {
  const chainB = [pr(200, "feat/200-a", "main"), pr(201, "feat/201-b", "feat/200-a")];
  const groups = detectStacks([CHAIN[1], chainB[1], CHAIN[0], chainB[0]]);
  const multi = groups.filter((group) => numbers(group).length > 1);
  assert.equal(multi.length, 2);
  assert.deepEqual(
    multi.map((group) => numbers(group).sort((a, b) => a - b)).sort(),
    [[200, 201], [945, 960]],
  );
});

test("detectStacks on an empty list yields no groups", () => {
  assert.deepEqual(detectStacks([]), []);
});

// --- Retry / backoff ------------------------------------------------------

function noRetry(value) {
  return value === null || value === 0 || value === false;
}

test("retry delays strictly increase with attempt and start near 60s", () => {
  const first = nextRetryDelayMs(1);
  const second = nextRetryDelayMs(2);
  const third = nextRetryDelayMs(3);
  for (const delay of [first, second, third]) {
    assert.equal(typeof delay, "number");
    assert.ok(Number.isFinite(delay) && delay > 0, `delay must be a positive number, got ${delay}`);
  }
  assert.ok(first >= 45_000 && first <= 90_000, `attempt 1 should be ~60s, got ${first}ms`);
  assert.ok(second > first, `attempt 2 (${second}ms) must exceed attempt 1 (${first}ms)`);
  assert.ok(second >= 1.5 * first && second <= 2.5 * first, `attempt 2 should be ~2x attempt 1, got ${second}ms`);
  assert.ok(third > second, `attempt 3 (${third}ms) must exceed attempt 2 (${second}ms)`);
  assert.ok(third >= 1.5 * second && third <= 2.5 * second, `attempt 3 should be ~2x attempt 2, got ${third}ms`);
  assert.ok(third <= 600_000, `attempt 3 delay must be capped, got ${third}ms`);
});

test("attempt 4 and beyond yield no retry: max 3 repair attempts per head", () => {
  for (const attempt of [4, 5, 10]) {
    assert.ok(noRetry(nextRetryDelayMs(attempt)), `attempt ${attempt} must yield no retry, got ${nextRetryDelayMs(attempt)}`);
  }
});

// --- Dry-run guard --------------------------------------------------------

function armedEnv(value) {
  // Canonical key is TRADEOS_PR_COMMANDER_WRITE_ENABLED (the repository
  // variable); the other keys are legacy aliases kept for coverage.
  return {
    TRADEOS_PR_COMMANDER_WRITE_ENABLED: value,
    PR_COMMANDER_ARMED: value,
    PR_COMMANDER_ENABLED: value,
    COMMANDER_ARMED: value,
  };
}

test("isArmed is true only for exactly the string \"true\"", () => {
  assert.equal(isArmed(armedEnv("true")), true);
});

for (const [label, env] of [
  ["absent (empty env)", {}],
  ["absent (no argument)", undefined],
  ["\"false\"", armedEnv("false")],
  ["\"1\"", armedEnv("1")],
  ["\"yes\"", armedEnv("yes")],
  ["\"TRUE\"", armedEnv("TRUE")],
  ["\" true\" (whitespace)", armedEnv(" true")],
  ["empty string", armedEnv("")],
]) {
  test(`isArmed is false for ${label}`, () => {
    assert.equal(isArmed(env), false);
  });
}

// --- File classification --------------------------------------------------

function assertClassification(files, expected) {
  const result = classifyPrFiles(files);
  for (const key of ["migrations", "rls", "auth", "protectedStaging", "other"]) {
    assert.equal(typeof result[key], "boolean", `${key} must be a boolean`);
    assert.equal(result[key], expected[key], `${key} for ${JSON.stringify(files)}`);
  }
}

test("migration paths are flagged as migrations", () => {
  assertClassification(
    ["app/prisma/migrations/20261110_add_permit_tasks/migration.sql"],
    { migrations: true, rls: false, auth: false, protectedStaging: false, other: false },
  );
  assertClassification(
    ["db/migrations/2026-11-10-permit-tasks.sql"],
    { migrations: true, rls: false, auth: false, protectedStaging: false, other: false },
  );
});

test("RLS paths are flagged as rls", () => {
  assertClassification(
    ["app/tests/rls.integration.ts"],
    { migrations: false, rls: true, auth: false, protectedStaging: false, other: false },
  );
  assertClassification(
    ["app/db/rls-policies.ts"],
    { migrations: false, rls: true, auth: false, protectedStaging: false, other: false },
  );
});

test("auth, middleware, and permissions paths are flagged as auth", () => {
  assertClassification(
    ["app/backend/middleware/auth.ts"],
    { migrations: false, rls: false, auth: true, protectedStaging: false, other: false },
  );
  assertClassification(
    ["app/backend/middleware/permissions.ts"],
    { migrations: false, rls: false, auth: true, protectedStaging: false, other: false },
  );
  assertClassification(
    ["web/src/lib/auth.ts"],
    { migrations: false, rls: false, auth: true, protectedStaging: false, other: false },
  );
});

test("staging workflow and env files are flagged as protectedStaging", () => {
  assertClassification(
    [".github/workflows/staging-deploy.yml"],
    { migrations: false, rls: false, auth: false, protectedStaging: true, other: false },
  );
  assertClassification(
    [".env.staging"],
    { migrations: false, rls: false, auth: false, protectedStaging: true, other: false },
  );
});

test("ordinary code paths are flagged only as other", () => {
  assertClassification(
    ["web/src/app/page.tsx", "app/modules/estimates/service.ts"],
    { migrations: false, rls: false, auth: false, protectedStaging: false, other: true },
  );
});

test("a non-staging workflow is not protectedStaging", () => {
  assertClassification(
    [".github/workflows/verify-repository.yml"],
    { migrations: false, rls: false, auth: false, protectedStaging: false, other: true },
  );
});

test("mixed files flag each category present and other when ordinary files exist", () => {
  assertClassification(
    ["app/prisma/migrations/20261110_x/migration.sql", "web/src/app/page.tsx"],
    { migrations: true, rls: false, auth: false, protectedStaging: false, other: true },
  );
});

test("an empty file list flags nothing", () => {
  assertClassification(
    [],
    { migrations: false, rls: false, auth: false, protectedStaging: false, other: false },
  );
});
