import "server-only";
import { cache } from "react";
import {
  getAthenaCapabilities,
  getDispatchSummary,
  getOrganizationSettings,
} from "@/lib/api";

// Request-scoped dedupe for the org reads the app shell and the Today
// dashboard both need — Vercel Fluid CPU fix plan (2026-11-26), Lever 2
// change 2.2.
//
// Before this, the (app) layout fetched getOrganizationSettings +
// getAthenaCapabilities for the shell, and loadTodayData fetched the same
// two again (plus getDispatchSummary) in the same request — React cache()
// on loadTodayData could not dedupe them because the layout called the
// getters directly. That was 2 wasted backend calls on every dashboard
// navigation. These wrappers share one backend call per request.
//
// The cache key is the session token only, on purpose:
// - React cache() is request-scoped, so the entry lives for one RSC
//   request and is fresh on the next navigation. A workspace switch
//   issues a fresh token (POST /auth/select-organization → issueSession),
//   so the key changes with the workspace.
// - The callers' AbortSignals are per-call objects; including one in the
//   key would defeat the dedupe (layout and Today create different
//   controllers). Instead the signal only bounds the *caller's wait* via
//   the race in withSignal: the shared fetch itself is not aborted, so a
//   layout timeout (5 s budget) no longer kills the read the dashboard
//   page is about to make — it reuses the in-flight fetch.
//
// No staleness: per-request scope only, exactly like the existing
// loadTodayData cache(). Memberships stay uncached (getWorkspaceMemberships
// keeps its cache: "no-store" invariant).

function waitForAbort(signal: AbortSignal): Promise<never> {
  if (signal.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException("The operation was aborted.", "AbortError"),
    );
  }
  return new Promise((_, reject) => {
    signal.addEventListener(
      "abort",
      () => reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError")),
      { once: true },
    );
  });
}

function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return Promise.race([promise, waitForAbort(signal)]);
}

const getSettingsFetch = cache((token: string) => getOrganizationSettings(token));
const getCapabilitiesFetch = cache((token: string) => getAthenaCapabilities(token));
const getDispatchSummaryFetch = cache((token: string) => getDispatchSummary(token));

export function getCachedOrganizationSettings(token: string, signal?: AbortSignal) {
  return withSignal(getSettingsFetch(token), signal);
}

export function getCachedAthenaCapabilities(token: string, signal?: AbortSignal) {
  return withSignal(getCapabilitiesFetch(token), signal);
}

export function getCachedDispatchSummary(token: string, signal?: AbortSignal) {
  return withSignal(getDispatchSummaryFetch(token), signal);
}
