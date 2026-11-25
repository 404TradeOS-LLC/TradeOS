import test from "node:test";
import assert from "node:assert/strict";
import { buildDayMapPins, dayMapBounds, MAX_DAY_MAP_PINS } from "./today-map.ts";
import type { TodayWorkItem } from "./today-model.ts";

function jobItem(overrides: Partial<TodayWorkItem> & { id: string }): TodayWorkItem {
  return {
    title: "Job",
    context: "JOB-1",
    kind: "job",
    start: "2026-11-25T14:00:00.000Z",
    end: "2026-11-25T16:00:00.000Z",
    assignee: null,
    status: "scheduled",
    href: "/dispatch",
    ...overrides,
  };
}

test("buildDayMapPins keeps only scheduled jobs with coordinates", () => {
  const pins = buildDayMapPins([
    jobItem({ id: "job-a", title: "Roof", siteAddress: "4050 S State Road 63, Terre Haute, IN 47802", latitude: 39.4665, longitude: -87.413 }),
    jobItem({ id: "job-b", title: "No address", siteAddress: null }),
    jobItem({ id: "job-c", title: "Not geocoded", siteAddress: "1 Main St, Terre Haute, IN 47802", latitude: null, longitude: null }),
    jobItem({ id: "task-a", kind: "task", title: "Task", start: "2026-11-25T14:00:00.000Z", siteAddress: "2 Main St, Terre Haute, IN 47802", latitude: 39.5, longitude: -87.4 }),
    jobItem({ id: "job-d", title: "Unscheduled", start: null, siteAddress: "3 Main St, Terre Haute, IN 47802", latitude: 39.5, longitude: -87.4 }),
  ]);
  assert.deepEqual(pins, [
    { id: "job-a", title: "Roof", address: "4050 S State Road 63, Terre Haute, IN 47802", lat: 39.4665, lon: -87.413, start: "2026-11-25T14:00:00.000Z" },
  ]);
});

test("buildDayMapPins drops non-finite coordinates", () => {
  const pins = buildDayMapPins([
    jobItem({ id: "job-nan", latitude: Number.NaN, longitude: -87.4, siteAddress: "NaN St" }),
    jobItem({ id: "job-inf", latitude: Number.POSITIVE_INFINITY, longitude: -87.4, siteAddress: "Inf St" }),
    jobItem({ id: "job-neg-inf", latitude: 39.5, longitude: Number.NEGATIVE_INFINITY, siteAddress: "Neg Inf St" }),
    jobItem({ id: "job-ok", latitude: 39.4665, longitude: -87.413, siteAddress: "4050 S State Road 63" }),
  ]);
  assert.deepEqual(
    pins.map((pin) => pin.id),
    ["job-ok"]
  );
});

test("buildDayMapPins caps the pin count", () => {
  const items = Array.from({ length: MAX_DAY_MAP_PINS + 3 }, (_, i) =>
    jobItem({ id: `job-${i}`, latitude: 39 + i * 0.01, longitude: -87.4, siteAddress: `${i} Main St` })
  );
  const pins = buildDayMapPins(items);
  assert.equal(pins.length, MAX_DAY_MAP_PINS);
  assert.ok(pins.every((pin) => Number.isFinite(pin.lat) && Number.isFinite(pin.lon)));
});

test("dayMapBounds returns null with no pins and the pin extent otherwise", () => {
  assert.equal(dayMapBounds([]), null);
  assert.deepEqual(
    dayMapBounds([
      { id: "a", title: "A", address: "1 Main St", lat: 39.4, lon: -87.5, start: null },
      { id: "b", title: "B", address: "2 Main St", lat: 39.5, lon: -87.3, start: null },
    ]),
    { minLat: 39.4, maxLat: 39.5, minLon: -87.5, maxLon: -87.3 }
  );
});
