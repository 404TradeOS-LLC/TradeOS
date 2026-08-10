import "server-only";

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
    periods?: Array<{
      name?: string;
      temperature?: number;
      temperatureUnit?: string;
      shortForecast?: string;
      probabilityOfPrecipitation?: { value?: number | null };
    }>;
  };
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
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
    const coordinates = await geocodeAddress(address);
    if (!coordinates) return null;

    const pointsResponse = await fetch(`https://api.weather.gov/points/${coordinates.lat.toFixed(4)},${coordinates.lon.toFixed(4)}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!pointsResponse.ok) return null;
    const points = (await pointsResponse.json()) as NwsPointsResponse;
    const forecastUrl = points.properties?.forecast;
    if (!forecastUrl) return null;

    const forecastResponse = await fetch(forecastUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!forecastResponse.ok) return null;
    const forecast = (await forecastResponse.json()) as NwsForecastResponse;
    const period = forecast.properties?.periods?.[0];
    if (!period || typeof period.temperature !== "number" || !period.shortForecast || !period.name) return null;

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
