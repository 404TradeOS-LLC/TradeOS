import type { TodayWorkItem } from "./today-model.ts";

/** One pin on the Day timeline map: a scheduled job at a geocoded site. */
export interface DayMapPin {
  id: string;
  title: string;
  address: string;
  lat: number;
  lon: number;
  start: string | null;
}

/**
 * A day rarely holds more than a handful of scheduled jobs, and each pin
 * costs a geocode lookup at load time. Ten bounds the lookups and keeps
 * the map readable; the timeline below it still lists every job.
 */
export const MAX_DAY_MAP_PINS = 10;

/**
 * Derives map pins from Today work items. Only scheduled jobs with a site
 * address and finite coordinates qualify — tasks have no site, visits
 * carry no address in this contract, and a failed geocode simply drops
 * that pin instead of breaking the timeline.
 */
export function buildDayMapPins(work: TodayWorkItem[]): DayMapPin[] {
  const pins: DayMapPin[] = [];
  const seen = new Set<string>();
  for (const item of work) {
    if (pins.length >= MAX_DAY_MAP_PINS) break;
    if (item.kind !== "job" || seen.has(item.id)) continue;
    if (!item.start || !Number.isFinite(Date.parse(item.start))) continue;
    if (typeof item.siteAddress !== "string" || item.siteAddress.trim().length === 0) continue;
    if (typeof item.latitude !== "number" || typeof item.longitude !== "number") continue;
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue;
    seen.add(item.id);
    pins.push({
      id: item.id,
      title: item.title,
      address: item.siteAddress,
      lat: item.latitude,
      lon: item.longitude,
      start: item.start,
    });
  }
  return pins;
}

/** Bounding box of the pins, for fitting the map viewport. Null when empty. */
export function dayMapBounds(pins: DayMapPin[]): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} | null {
  if (pins.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const pin of pins) {
    minLat = Math.min(minLat, pin.lat);
    maxLat = Math.max(maxLat, pin.lat);
    minLon = Math.min(minLon, pin.lon);
    maxLon = Math.max(maxLon, pin.lon);
  }
  return { minLat, maxLat, minLon, maxLon };
}
