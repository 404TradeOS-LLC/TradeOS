// Pure geocoding logic, deliberately WITHOUT a `server-only` import so it
// can be unit tested with a plain `import` under `node --test` (see
// web/src/lib/athena-state.ts for the same split: `server-only` anywhere
// in a module's chain makes it throw outside a Next server bundle). The
// server boundary lives at the importers — web/src/lib/weather.ts and
// web/src/lib/today-data.ts (via api.ts) both carry it — so this module
// is only ever reached from server code in production.

// The Census Bureau's free geocoder (no key, no account) turns a US street
// address into coordinates. Shared by the weather forecast and the Today
// day map: both are supplementary panels, so a slow or failing lookup must
// return null and let the caller render an honest "unavailable" state
// instead of holding up the server render or fabricating a location.
const REVALIDATE_SECONDS = 1800;

interface CensusGeocodeResponse {
  result?: {
    addressMatches?: Array<{
      coordinates?: { x?: number; y?: number };
      matchedAddress?: string;
    }>;
  };
}

/**
 * Geocodes a US street address via the Census Bureau's free geocoder.
 * Returns null on any failure — unmatched/non-US address, geocoder
 * outage, unexpected response shape, aborted or failed fetch — so callers
 * can degrade gracefully instead of throwing.
 */
export async function geocodeAddress(
  address: string,
  signal: AbortSignal
): Promise<{ lat: number; lon: number } | null> {
  try {
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
  } catch {
    return null;
  }
}
