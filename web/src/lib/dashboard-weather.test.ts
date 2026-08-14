import test from "node:test";
import assert from "node:assert/strict";
import { loadDashboardWeather, selectDashboardWeatherAddress } from "./dashboard-weather.ts";

test("selectDashboardWeatherAddress prefers the first valid job-site address", () => {
  const result = selectDashboardWeatherAddress({
    jobSiteAddresses: ["", "  101 Jobsite Lane, Terre Haute, IN 47802  ", "202 Backup Road"],
    persistedOrganizationAddress: "404 Office Avenue, Terre Haute, IN 47807",
  });

  assert.equal(result, "101 Jobsite Lane, Terre Haute, IN 47802");
});

test("selectDashboardWeatherAddress uses the persisted organization address when no job site is available", () => {
  const result = selectDashboardWeatherAddress({
    jobSiteAddresses: [null, undefined, "   "],
    persistedOrganizationAddress: " 404 Office Avenue, Terre Haute, IN 47807 ",
  });

  assert.equal(result, "404 Office Avenue, Terre Haute, IN 47807");
});

test("selectDashboardWeatherAddress does not invent the demo/default settings address", () => {
  const result = selectDashboardWeatherAddress({
    jobSiteAddresses: [],
    persistedOrganizationAddress: undefined,
  });

  assert.equal(result, null);
});

test("selectDashboardWeatherAddress returns null when no real address exists", () => {
  const result = selectDashboardWeatherAddress({
    jobSiteAddresses: ["", "   "],
    persistedOrganizationAddress: "   ",
  });

  assert.equal(result, null);
});

test("loadDashboardWeather fails soft when the upstream lookup rejects", async () => {
  const result = await loadDashboardWeather("404 Office Avenue, Terre Haute, IN 47807", async () => {
    throw new Error("weather upstream unavailable");
  });

  assert.equal(result, null);
});
