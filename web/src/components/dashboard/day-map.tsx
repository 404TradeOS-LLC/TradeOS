"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { dayMapBounds, type DayMapPin } from "@/lib/today-map";

/**
 * Map of today's scheduled job sites. Pins are job-site addresses the
 * organization already stores — never live crew locations. Tiles come
 * from OpenStreetMap (free, no key, no account); tile requests reveal the
 * viewed map area to the tile host, so the map renders only when there
 * are pins to show and degrades to the timeline alone otherwise.
 */
export function DayMap({ pins, timeZone }: { pins: DayMapPin[]; timeZone: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Popup content (start, title, address) is part of the key: a job
  // rescheduled or renamed without moving keeps its coordinates, and the
  // markers must rebuild so the popup shows the new time and title.
  const pinsKey = pins.map((pin) => `${pin.id}:${pin.lat},${pin.lon}:${pin.start ?? ""}:${pin.title}:${pin.address}`).join("|");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || pins.length === 0) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map = L.map(container, {
        scrollWheelZoom: false,
        zoomAnimation: !reducedMotion,
        fadeAnimation: !reducedMotion,
        attributionControl: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      for (const pin of pins) {
        const marker = L.marker([pin.lat, pin.lon], {
          icon: L.divIcon({ className: "day-map-pin", html: "<span></span>", iconSize: [18, 18], iconAnchor: [9, 9] }),
          title: pin.title,
        });
        const time = pin.start
          ? new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(pin.start))
          : null;
        marker.bindPopup(
          `<strong>${escapeHtml(pin.title)}</strong>` +
            (time ? `<br>${escapeHtml(time)}` : "") +
            `<br>${escapeHtml(pin.address)}`
        );
        marker.addTo(map);
      }
      const bounds = dayMapBounds(pins);
      if (bounds) {
        if (pins.length === 1) map.setView([pins[0].lat, pins[0].lon], 13);
        else map.fitBounds([[bounds.minLat, bounds.minLon], [bounds.maxLat, bounds.maxLon]], { padding: [24, 24] });
      }
    });

    return () => {
      cancelled = true;
      if (map) {
        map.remove();
        map = null;
      }
    };
    // Rebuild only when the pin set changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, timeZone]);

  if (pins.length === 0) return null;
  return (
    <div
      ref={containerRef}
      className="today-day-map"
      role="region"
      aria-label="Map of today's scheduled job sites"
    />
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
