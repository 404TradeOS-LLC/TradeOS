import "server-only";
import { ForecastPeriodCandidate, selectRelevantForecastPeriod } from "@/lib/weather-forecast";

export interface WeatherSnapshot {
  locationLabel: string;
  periodName: string;
  shortForecast: string;
  temperature: number;
  temperatureUnit: string;
  precipitationChance: number | null;
}

const USER_AGENT = "TradeOS (https://app.404tradeos.com, support@404tradeos.com)";
// NWS asks callers to identify themselves and to cache; both API calls are
// free/keyless government data, so revalidate on a fixed interval rather
// than refetch on every dashboard render.
const REVALIDATE_SECONDS = 1800;
// This is a supplementary dashboard panel, not a core dependency (same
// principle as the knowledge-stats panel in dashboard/page.tsx) - a slow or
// hanging upstream must never hold up the whole server render. One shared
// deadline covers all three sequential calls (geocode -> points -> forecast)
// rather than budgeting each individually.
const TOTAL_TIMEOUT_MS = 5000;

interface CensusGeocodeResponse {
  result?: {
    addressMatches?: Array<{
      coordinates?: { x?: number; y?: number };
      matchedAddress?: string;
    }>;
  };
}

interface NwsPointsResponse {
  properties?: {
    forecast?: string;
    relativeLocation?: { properties?: { city?: string; state?: string } };
  };
}

interface NwsForecastResponse {
  properties?: {
    periods?: ForecastPeriodCandidate[];
  };
}

async function geocodeAddress(address: string, signal: AbortSignal): Promise<{ lat: number; lon: number } | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { signal, next: { revalidate: REVALIDATE_SECONDS } });
  if (!response.ok) return null;

  const data = (await response.json()) as CensusGeocodeResponse;
  const match = data.result?.addressMatches?.[0];
  const lat = match?.coordinates?.y;
  const lon = match?.coordinates?.x;
  if (typeof lat !== "number" || typeof lon !== "number") return null;

  return { lat, lon };
}

/**
 * Fetches a National Weather Service forecast for a US street address, via
 * the Census Bureau's free geocoder (NWS itself only accepts lat/lon, not
 * addresses). Returns null on any failure - unmatched/non-US address,
 * geocoder or NWS outage, unexpected response shape - so the dashboard can
 * render an honest "unavailable" state instead of fabricating a forecast.
 */
export async function getWeatherForAddress(address: string): Promise<WeatherSnapshot | null> {
  try {
    const signal = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
    const coordinates = await geocodeAddress(address, signal);
    if (!coordinates) return null;

    const pointsResponse = await fetch(`https://api.weather.gov/points/${coordinates.lat.toFixed(4)},${coordinates.lon.toFixed(4)}`, {
      signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!pointsResponse.ok) return null;
    const points = (await pointsResponse.json()) as NwsPointsResponse;
    const forecastUrl = points.properties?.forecast;
    if (!forecastUrl) return null;

    const forecastResponse = await fetch(forecastUrl, {
      signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!forecastResponse.ok) return null;
    const forecast = (await forecastResponse.json()) as NwsForecastResponse;
    const period = selectRelevantForecastPeriod(forecast.properties?.periods);
    if (!period) return null;

    const relativeLocation = points.properties?.relativeLocation?.properties;
    const locationLabel =
      relativeLocation?.city && relativeLocation?.state ? `${relativeLocation.city}, ${relativeLocation.state}` : address;

    return {
      locationLabel,
      periodName: period.name,
      shortForecast: period.shortForecast,
      temperature: period.temperature,
      temperatureUnit: period.temperatureUnit ?? "F",
      precipitationChance: period.probabilityOfPrecipitation?.value ?? null,
    };
  } catch {
    return null;
  }
}
