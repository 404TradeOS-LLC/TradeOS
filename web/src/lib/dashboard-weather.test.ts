import test from "node:test";
import assert from "node:assert/strict";
import { loadDashboardWeather, selectDashboardWeatherAddress } from "./dashboard-weather.ts";

test("selectDashboardWeatherAddress suppresses standing dashboard weather even when addresses exist", () => {
  const result = selectDashboardWeatherAddress({
    jobSiteAddresses: ["101 Jobsite Lane, Terre Haute, IN 47802"],
    persistedOrganizationAddress: "404 Office Avenue, Terre Haute, IN 47807",
  });

  assert.equal(result, null);
});

test("loadDashboardWeather skips the upstream lookup when no dashboard weather address is selected", async () => {
  let calls = 0;
  const result = await loadDashboardWeather(null, async () => {
    calls += 1;
    return { shortForecast: "Sunny" };
  });

  assert.equal(result, null);
  assert.equal(calls, 0);
});

test("loadDashboardWeather still fails soft for compatibility callers", async () => {
  const result = await loadDashboardWeather("404 Office Avenue, Terre Haute, IN 47807", async () => {
    throw new Error("weather upstream unavailable");
  });

  assert.equal(result, null);
});
