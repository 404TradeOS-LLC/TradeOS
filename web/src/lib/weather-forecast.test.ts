import test from "node:test";
import assert from "node:assert/strict";
import { selectRelevantForecastPeriod } from "./weather-forecast.ts";

test("selectRelevantForecastPeriod returns the current forecast window when one is active", () => {
  const result = selectRelevantForecastPeriod(
    [
      {
        name: "Tonight",
        startTime: "2026-08-13T19:00:00-04:00",
        endTime: "2026-08-14T06:00:00-04:00",
        temperature: 75,
        shortForecast: "Mostly Cloudy",
      },
      {
        name: "Friday",
        startTime: "2026-08-14T06:00:00-04:00",
        endTime: "2026-08-14T18:00:00-04:00",
        temperature: 86,
        shortForecast: "Sunny",
      },
    ],
    new Date("2026-08-13T22:30:00-04:00")
  );

  assert.equal(result?.name, "Tonight");
});

test("selectRelevantForecastPeriod falls forward to the next upcoming period when current is absent", () => {
  const result = selectRelevantForecastPeriod(
    [
      {
        name: "Overnight",
        startTime: "2026-08-12T18:00:00-04:00",
        endTime: "2026-08-13T06:00:00-04:00",
        temperature: 68,
        shortForecast: "Clear",
      },
      {
        name: "Thursday",
        startTime: "2026-08-13T06:00:00-04:00",
        endTime: "2026-08-13T18:00:00-04:00",
        temperature: 84,
        shortForecast: "Sunny",
      },
      {
        name: "Thursday Night",
        startTime: "2026-08-13T20:00:00-04:00",
        endTime: "2026-08-14T06:00:00-04:00",
        temperature: 73,
        shortForecast: "Partly Cloudy",
      },
    ],
    new Date("2026-08-13T18:00:00-04:00")
  );

  assert.equal(result?.name, "Thursday Night");
});

test("selectRelevantForecastPeriod ignores malformed rows and returns null when no usable period exists", () => {
  const result = selectRelevantForecastPeriod([
    { name: "Bad row", shortForecast: "Cloudy" },
    { temperature: 81, shortForecast: "Sunny" },
  ]);

  assert.equal(result, null);
});
