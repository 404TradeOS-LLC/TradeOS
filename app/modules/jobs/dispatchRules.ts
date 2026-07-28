// Shared, pure business-logic rules for the Dispatcher Workspace.
//
// This module is the single source of truth for what counts as "actionable" or
// "overdue" for a Job, and for org-timezone-aware day/window boundary math. Both
// the backend summary endpoint and the frontend consume these helpers so status
// rules are never duplicated. All status sets below are DERIVED from the
// canonical `jobStatuses` array (and shared `isTerminalStatus` helper) in
// `domain/contracts.ts` rather than hardcoded, so this file automatically stays
// in sync if the canonical job status list ever changes.

import { jobStatuses, isTerminalStatus, JobStatus } from "../../domain/contracts";

/**
 * Resolves a raw, possibly-untrusted organization timezone string to a
 * validated IANA timezone. Falls back to "UTC" (with `isFallback: true`) for
 * anything empty, non-string, or not accepted by `Intl.DateTimeFormat` as a
 * `timeZone` option.
 */
export function resolveOrgTimezone(rawTimezone: string | null | undefined): {
  timezone: string;
  isFallback: boolean;
} {
  if (typeof rawTimezone === "string" && rawTimezone.trim().length > 0) {
    try {
      // Constructing the formatter is enough to validate the IANA zone name;
      // invalid zones throw a RangeError. We don't need to format anything.
      // eslint-disable-next-line no-new
      new Intl.DateTimeFormat("en-US", { timeZone: rawTimezone });
      return { timezone: rawTimezone, isFallback: false };
    } catch {
      // Falls through to the UTC fallback below for any invalid zone.
    }
  }
  return { timezone: "UTC", isFallback: true };
}

// Node 18+ supports `timeZoneName: "longOffset"` (e.g. "GMT-04:00"), which is
// what we prefer since it always includes minutes. Older runtimes only support
// "shortOffset" (e.g. "GMT-4"), so we detect support once and fall back.
function detectOffsetTimeZoneNameStyle(): "longOffset" | "shortOffset" {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      timeZoneName: "longOffset",
    }).formatToParts(new Date());
    if (parts.some((part) => part.type === "timeZoneName")) {
      return "longOffset";
    }
  } catch {
    // Fall through to shortOffset below.
  }
  return "shortOffset";
}

const OFFSET_TIME_ZONE_NAME_STYLE = detectOffsetTimeZoneNameStyle();

interface LocalCalendarParts {
  year: number;
  month: number; // 1-12
  day: number;
}

/**
 * Reads the UTC offset (in minutes, i.e. `local - utc`) in effect for the
 * given timezone at the given instant, directly from
 * `Intl.DateTimeFormat(...).formatToParts` — no iterative offset-guessing.
 *
 * Examples: "GMT-04:00" (America/New_York, EDT) -> -240
 *           "GMT+05:30" (Asia/Kolkata)           -> +330
 *           "GMT" / "GMT+00:00" (UTC)            -> 0
 */
function readUtcOffsetMinutes(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: OFFSET_TIME_ZONE_NAME_STYLE,
  }).formatToParts(instant);

  const offsetPart = parts.find((part) => part.type === "timeZoneName");
  const raw = offsetPart?.value ?? "GMT";

  const match = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(raw.trim());
  if (!match) {
    // Bare "GMT" (or an unrecognized format) means zero offset.
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = match[3] ? Number(match[3]) : 0;
  return sign * (hours * 60 + minutes);
}

/** Reads the local calendar (year/month/day) that `instant` falls on in `timezone`. */
function readLocalCalendarParts(instant: Date, timezone: string): LocalCalendarParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(instant);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

/**
 * Adds (or subtracts) whole calendar days to a Y/M/D triple, correctly
 * rolling over month/year boundaries. Pure calendar arithmetic — performed
 * via `Date.UTC`'s own overflow normalization, not via instant/offset math,
 * so it is unaffected by DST.
 */
function addCalendarDays(parts: LocalCalendarParts, days: number): LocalCalendarParts {
  const rolled = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 0, 0, 0, 0));
  return { year: rolled.getUTCFullYear(), month: rolled.getUTCMonth() + 1, day: rolled.getUTCDate() };
}

/**
 * Computes the UTC instant corresponding to local midnight (00:00:00.000) on
 * the given local calendar day in `timezone`.
 *
 * Treats the Y/M/D as if it were a UTC instant ("naive" instant), reads the
 * UTC offset in effect *at that naive instant*, and shifts by it to get a
 * first candidate. That single-pass approach is correct for the vast
 * majority of zones/dates, but is WRONG whenever the offset in effect at the
 * naive instant differs from the offset actually in effect at the resulting
 * candidate instant — which happens for zones whose DST transition falls at
 * or near local midnight itself (e.g. America/Santiago), where reading the
 * offset at the naive instant can select the wrong side of the transition
 * and land the boundary an hour (or more) into the wrong local day.
 *
 * Fixed by re-resolving the offset AT the candidate instant and recomputing
 * if it changed, iterating to a fixed point (bounded, since a real timezone
 * transition is a single step at one instant, not an oscillation — this
 * always converges in at most a couple of iterations).
 */
function utcInstantForLocalMidnight(year: number, month: number, day: number, timezone: string): Date {
  const naiveUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  let offsetMinutes = readUtcOffsetMinutes(new Date(naiveUtcMs), timezone);
  let candidateMs = naiveUtcMs - offsetMinutes * 60_000;

  for (let i = 0; i < 4; i++) {
    const resolvedOffsetMinutes = readUtcOffsetMinutes(new Date(candidateMs), timezone);
    if (resolvedOffsetMinutes === offsetMinutes) break;
    offsetMinutes = resolvedOffsetMinutes;
    candidateMs = naiveUtcMs - offsetMinutes * 60_000;
  }

  return new Date(candidateMs);
}

/**
 * Returns the UTC instants bounding the calendar day (in `timezone`) that
 * `referenceInstant` falls on: `startUtc` is local 00:00:00.000, `endUtc` is
 * the start of the next local day (i.e. local 24:00:00.000 == next day's
 * 00:00:00.000).
 */
export function getOrgDayBoundaryUtc(referenceInstant: Date, timezone: string): { startUtc: Date; endUtc: Date } {
  const localParts = readLocalCalendarParts(referenceInstant, timezone);

  const startUtc = utcInstantForLocalMidnight(localParts.year, localParts.month, localParts.day, timezone);

  const nextDayParts = addCalendarDays(localParts, 1);
  const endUtc = utcInstantForLocalMidnight(nextDayParts.year, nextDayParts.month, nextDayParts.day, timezone);

  return { startUtc, endUtc };
}

/**
 * Returns a rolling window starting at the local start-of-day boundary for
 * `referenceInstant` (in `timezone`) and ending `days` calendar days later,
 * at that later day's local start-of-day boundary (e.g. `days: 7` for a
 * "next 7 days" filter). Reuses `getOrgDayBoundaryUtc` internally rather
 * than reimplementing the boundary math.
 */
export function getRollingWindowUtc(referenceInstant: Date, timezone: string, days: number): { startUtc: Date; endUtc: Date } {
  const { startUtc } = getOrgDayBoundaryUtc(referenceInstant, timezone);

  // Find a probe instant guaranteed to fall within the target local day
  // (its own local midnight), then reuse getOrgDayBoundaryUtc on that probe
  // to get the target day's start boundary as our window's end boundary.
  const localParts = readLocalCalendarParts(referenceInstant, timezone);
  const targetParts = addCalendarDays(localParts, days);
  const targetDayProbe = utcInstantForLocalMidnight(targetParts.year, targetParts.month, targetParts.day, timezone);
  const { startUtc: endUtc } = getOrgDayBoundaryUtc(targetDayProbe, timezone);

  return { startUtc, endUtc };
}

/**
 * Job statuses that are terminal (no further dispatcher action is expected):
 * derived by filtering the canonical `jobStatuses` array through the shared
 * `isTerminalStatus` helper from `domain/contracts.ts`, rather than
 * hardcoding a second copy of the terminal set.
 */
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = jobStatuses.filter((status) => isTerminalStatus(status));

/**
 * Job statuses that represent active, in-progress work: every canonical job
 * status that is neither terminal nor `unscheduled` (which is its own,
 * non-terminal "not yet started" state, not "in progress"). Derived by
 * filtering the canonical `jobStatuses` array — not hardcoded — so this
 * automatically tracks any future additions to the canonical status list.
 */
export const IN_PROGRESS_JOB_STATUSES: readonly JobStatus[] = jobStatuses.filter(
  (status) => !isTerminalStatus(status) && status !== "unscheduled"
);

/** True iff the job is in progress and its scheduled start has already passed. */
export function isJobOverdue(job: { status: string; scheduledStart: Date | string | null }, now: Date): boolean {
  if (!(IN_PROGRESS_JOB_STATUSES as readonly string[]).includes(job.status)) {
    return false;
  }
  if (job.scheduledStart === null) {
    return false;
  }
  const scheduledStart = job.scheduledStart instanceof Date ? job.scheduledStart : new Date(job.scheduledStart);
  return scheduledStart.getTime() < now.getTime();
}

/** True iff the job is non-terminal and has no active assignments. */
export function isJobUnassigned(job: { status: string; activeAssignmentCount: number }): boolean {
  return !(TERMINAL_JOB_STATUSES as readonly string[]).includes(job.status) && job.activeAssignmentCount === 0;
}

/** True iff the job is unscheduled (by definition non-terminal, needs a dispatcher to schedule it). */
export function isJobUnscheduledActive(job: { status: string }): boolean {
  return job.status === "unscheduled";
}

/**
 * True iff the job needs dispatcher attention for any reason: overdue,
 * unassigned, or unscheduled.
 *
 * IMPORTANT for callers building an aggregate COUNT of "jobs needing
 * attention": a single job can match more than one predicate at once (e.g.
 * an unassigned job that is also overdue). Build the count with one OR'd
 * query (equivalent to this function's boolean OR), NOT by summing three
 * separate per-predicate counts — summing would double-count jobs that
 * match multiple predicates and overstate how many jobs actually need
 * attention.
 */
export function jobNeedsAttention(
  job: { status: string; scheduledStart: Date | string | null; activeAssignmentCount: number },
  now: Date
): boolean {
  return isJobOverdue(job, now) || isJobUnassigned(job) || isJobUnscheduledActive(job);
}
