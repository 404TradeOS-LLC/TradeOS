import { jobStatuses } from "../domain/contracts";
import {
  getOrgDayBoundaryUtc,
  getRollingWindowUtc,
  IN_PROGRESS_JOB_STATUSES,
  isJobOverdue,
  isJobUnassigned,
  isJobUnscheduledActive,
  jobNeedsAttention,
  resolveOrgTimezone,
  TERMINAL_JOB_STATUSES,
} from "../modules/jobs/dispatchRules";

describe("resolveOrgTimezone", () => {
  it("accepts a valid IANA timezone string", () => {
    expect(resolveOrgTimezone("America/New_York")).toEqual({
      timezone: "America/New_York",
      isFallback: false,
    });
  });

  it("accepts UTC", () => {
    expect(resolveOrgTimezone("UTC")).toEqual({ timezone: "UTC", isFallback: false });
  });

  it("falls back to UTC for an invalid timezone string", () => {
    expect(resolveOrgTimezone("Not/AZone")).toEqual({ timezone: "UTC", isFallback: true });
  });

  it("falls back to UTC for an empty string", () => {
    expect(resolveOrgTimezone("")).toEqual({ timezone: "UTC", isFallback: true });
  });

  it("falls back to UTC for a whitespace-only string", () => {
    expect(resolveOrgTimezone("   ")).toEqual({ timezone: "UTC", isFallback: true });
  });

  it("falls back to UTC for undefined", () => {
    expect(resolveOrgTimezone(undefined)).toEqual({ timezone: "UTC", isFallback: true });
  });

  it("falls back to UTC for null", () => {
    expect(resolveOrgTimezone(null)).toEqual({ timezone: "UTC", isFallback: true });
  });
});

describe("getOrgDayBoundaryUtc", () => {
  it("computes exact boundaries in UTC itself", () => {
    const { startUtc, endUtc } = getOrgDayBoundaryUtc(new Date("2026-07-28T12:00:00.000Z"), "UTC");
    expect(startUtc.toISOString()).toBe("2026-07-28T00:00:00.000Z");
    expect(endUtc.toISOString()).toBe("2026-07-29T00:00:00.000Z");
  });

  it("computes exact boundaries for America/New_York during EDT (summer, UTC-4)", () => {
    const { startUtc, endUtc } = getOrgDayBoundaryUtc(new Date("2026-07-28T18:00:00.000Z"), "America/New_York");
    // Local midnight 2026-07-28 EDT (-04:00) => 2026-07-28T04:00:00Z
    expect(startUtc.toISOString()).toBe("2026-07-28T04:00:00.000Z");
    expect(endUtc.toISOString()).toBe("2026-07-29T04:00:00.000Z");
  });

  it("computes exact boundaries for America/New_York during EST (winter, UTC-5)", () => {
    const { startUtc, endUtc } = getOrgDayBoundaryUtc(new Date("2026-01-15T18:00:00.000Z"), "America/New_York");
    // Local midnight 2026-01-15 EST (-05:00) => 2026-01-15T05:00:00Z
    expect(startUtc.toISOString()).toBe("2026-01-15T05:00:00.000Z");
    expect(endUtc.toISOString()).toBe("2026-01-16T05:00:00.000Z");
  });

  it("computes exact boundaries for Asia/Kolkata (+05:30, half-hour offset)", () => {
    const { startUtc, endUtc } = getOrgDayBoundaryUtc(new Date("2026-07-28T10:00:00.000Z"), "Asia/Kolkata");
    // Local midnight 2026-07-28 IST (+05:30) => 2026-07-27T18:30:00Z
    expect(startUtc.toISOString()).toBe("2026-07-27T18:30:00.000Z");
    expect(endUtc.toISOString()).toBe("2026-07-28T18:30:00.000Z");
  });

  it("handles the US spring-forward DST transition day (2026-03-08, America/New_York): the local day is 23 hours long", () => {
    const { startUtc, endUtc } = getOrgDayBoundaryUtc(new Date("2026-03-08T18:00:00.000Z"), "America/New_York");
    // Start of day is still EST (-05:00, transition hasn't happened yet at 00:00 local).
    expect(startUtc.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    // End of day (next midnight) is already EDT (-04:00, transition happened at 2am local).
    expect(endUtc.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(endUtc.getTime() - startUtc.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it("handles the US fall-back DST transition day (2026-11-01, America/New_York): the local day is 25 hours long", () => {
    const { startUtc, endUtc } = getOrgDayBoundaryUtc(new Date("2026-11-01T18:00:00.000Z"), "America/New_York");
    // Start of day is still EDT (-04:00, transition hasn't happened yet at 00:00 local).
    expect(startUtc.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    // End of day (next midnight) is already EST (-05:00, transition happened at 2am local).
    expect(endUtc.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(endUtc.getTime() - startUtc.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it("rolls over month/year boundaries correctly", () => {
    const { startUtc, endUtc } = getOrgDayBoundaryUtc(new Date("2026-12-31T12:00:00.000Z"), "UTC");
    expect(startUtc.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(endUtc.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  /**
   * Reads the Y/M/D/H/M/S that `instant` formats to in `timezone`, as a
   * "YYYY-MM-DD HH:mm:ss" string, for exact round-trip assertions below.
   * A single-pass naive-offset lookup can select the wrong side of a DST
   * transition that falls at/near local midnight (see the bug this test
   * guards against); round-tripping through Intl itself, rather than
   * hand-computing an expected UTC instant, is what actually proves the
   * boundary lands on the correct local calendar day and time.
   */
  function formatInZone(instant: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(instant);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "??";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
  }

  it("resolves local midnight correctly for a DST transition that falls at/near local midnight itself (America/Santiago), not just the offset in effect at the naive UTC instant", () => {
    // Chile's DST transition falls at local midnight (rather than 2am, like
    // the US) on the first Saturday of April: for 2026 that's 2026-04-04
    // going into 2026-04-05. A single-pass "read the offset at the naive
    // UTC instant, then shift by it" implementation can pick the wrong
    // side of that transition and land an hour or more into the previous
    // local day (this is exactly what was reported: the un-fixed code
    // returned 2026-04-05T03:00:00.000Z, which formats as 2026-04-04
    // 23:00:00 in America/Santiago, not local midnight of 2026-04-05).
    const { startUtc, endUtc } = getOrgDayBoundaryUtc(new Date("2026-04-05T12:00:00.000Z"), "America/Santiago");

    expect(formatInZone(startUtc, "America/Santiago")).toBe("2026-04-05 00:00:00");
    expect(formatInZone(endUtc, "America/Santiago")).toBe("2026-04-06 00:00:00");
    // Guard against the specific regression: the wrong single-pass answer.
    expect(startUtc.toISOString()).not.toBe("2026-04-05T03:00:00.000Z");
  });

  it("classifies a job scheduled just before vs. just after the (corrected) local-midnight boundary on opposite sides of it, across the Santiago transition", () => {
    const { startUtc, endUtc } = getOrgDayBoundaryUtc(new Date("2026-04-05T12:00:00.000Z"), "America/Santiago");

    const oneMsBeforeStart = new Date(startUtc.getTime() - 1);
    const oneMsAfterStart = new Date(startUtc.getTime() + 1);
    const oneMsBeforeEnd = new Date(endUtc.getTime() - 1);
    const oneMsAfterEnd = new Date(endUtc.getTime() + 1);

    // Mirrors the [gte: startUtc, lt: endUtc) "today" comparison
    // JobsService.getDispatchSummary actually performs.
    const isWithinToday = (instant: Date) => instant.getTime() >= startUtc.getTime() && instant.getTime() < endUtc.getTime();

    expect(isWithinToday(oneMsBeforeStart)).toBe(false);
    expect(isWithinToday(oneMsAfterStart)).toBe(true);
    expect(isWithinToday(oneMsBeforeEnd)).toBe(true);
    expect(isWithinToday(oneMsAfterEnd)).toBe(false);

    expect(formatInZone(oneMsBeforeStart, "America/Santiago")).toBe("2026-04-04 23:59:59");
    expect(formatInZone(oneMsAfterEnd, "America/Santiago")).toBe("2026-04-06 00:00:00");
  });

  it("resolves local midnight correctly just before and after a standard (non-midnight) DST transition too (America/New_York spring-forward day)", () => {
    const { startUtc, endUtc } = getOrgDayBoundaryUtc(new Date("2026-03-08T18:00:00.000Z"), "America/New_York");
    expect(formatInZone(startUtc, "America/New_York")).toBe("2026-03-08 00:00:00");
    expect(formatInZone(endUtc, "America/New_York")).toBe("2026-03-09 00:00:00");
  });
});

describe("getRollingWindowUtc", () => {
  it("uses the same start boundary as getOrgDayBoundaryUtc and ends `days` local calendar days later", () => {
    const reference = new Date("2026-07-28T18:00:00.000Z");
    const dayBoundary = getOrgDayBoundaryUtc(reference, "America/New_York");
    const rolling = getRollingWindowUtc(reference, "America/New_York", 7);

    expect(rolling.startUtc.toISOString()).toBe(dayBoundary.startUtc.toISOString());
    // 7 full days later, no DST transition in between: exactly 7*24h after start.
    expect(rolling.endUtc.toISOString()).toBe("2026-08-04T04:00:00.000Z");
    expect(rolling.endUtc.getTime() - rolling.startUtc.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("correctly spans a DST transition within the rolling window (fewer than 24*days hours)", () => {
    // Window from 2026-03-05 through 2026-03-12 (7 days) strictly contains the
    // spring-forward transition instant (2am local on 2026-03-08), so the real
    // elapsed time is 1 hour less than a plain 7*24h span.
    const reference = new Date("2026-03-05T12:00:00.000Z");
    const rolling = getRollingWindowUtc(reference, "America/New_York", 7);
    expect(rolling.startUtc.toISOString()).toBe("2026-03-05T05:00:00.000Z");
    expect(rolling.endUtc.toISOString()).toBe("2026-03-12T04:00:00.000Z");
    const plainSevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(rolling.endUtc.getTime() - rolling.startUtc.getTime()).toBe(plainSevenDaysMs - 60 * 60 * 1000);
  });

  it("works for a zero-day window (start === end)", () => {
    const reference = new Date("2026-07-28T18:00:00.000Z");
    const rolling = getRollingWindowUtc(reference, "America/New_York", 0);
    expect(rolling.startUtc.toISOString()).toBe(rolling.endUtc.toISOString());
  });
});

describe("canonical job status derivation", () => {
  it("derives TERMINAL_JOB_STATUSES as exactly completed and cancelled", () => {
    expect([...TERMINAL_JOB_STATUSES].sort()).toEqual(["cancelled", "completed"]);
  });

  it("derives IN_PROGRESS_JOB_STATUSES as every non-terminal status except unscheduled", () => {
    expect([...IN_PROGRESS_JOB_STATUSES].sort()).toEqual(
      ["dispatched", "on_site", "paused", "scheduled", "traveling"].sort()
    );
  });

  it("TERMINAL_JOB_STATUSES and IN_PROGRESS_JOB_STATUSES partition jobStatuses along with 'unscheduled'", () => {
    const accountedFor = new Set([...TERMINAL_JOB_STATUSES, ...IN_PROGRESS_JOB_STATUSES, "unscheduled"]);
    expect([...accountedFor].sort()).toEqual([...jobStatuses].sort());
    // No overlap between the two derived sets.
    for (const status of IN_PROGRESS_JOB_STATUSES) {
      expect(TERMINAL_JOB_STATUSES).not.toContain(status);
    }
  });
});

describe("isJobOverdue", () => {
  const now = new Date("2026-07-28T12:00:00.000Z");

  it("is true for an in-progress job with a scheduledStart in the past", () => {
    expect(
      isJobOverdue({ status: "scheduled", scheduledStart: new Date("2026-07-28T09:00:00.000Z") }, now)
    ).toBe(true);
  });

  it("is false for an in-progress job with a scheduledStart in the future", () => {
    expect(
      isJobOverdue({ status: "scheduled", scheduledStart: new Date("2026-07-28T15:00:00.000Z") }, now)
    ).toBe(false);
  });

  it("is false for a completed job even with a scheduledStart far in the past", () => {
    expect(
      isJobOverdue({ status: "completed", scheduledStart: new Date("2026-01-01T00:00:00.000Z") }, now)
    ).toBe(false);
  });

  it("is false for a cancelled job even with a scheduledStart in the past", () => {
    expect(
      isJobOverdue({ status: "cancelled", scheduledStart: new Date("2026-01-01T00:00:00.000Z") }, now)
    ).toBe(false);
  });

  it("is false for an unscheduled job (not in-progress) even with a scheduledStart in the past", () => {
    expect(
      isJobOverdue({ status: "unscheduled", scheduledStart: new Date("2026-01-01T00:00:00.000Z") }, now)
    ).toBe(false);
  });

  it("is false when scheduledStart is null", () => {
    expect(isJobOverdue({ status: "dispatched", scheduledStart: null }, now)).toBe(false);
  });

  it("accepts a string scheduledStart and parses it", () => {
    expect(isJobOverdue({ status: "on_site", scheduledStart: "2026-07-28T09:00:00.000Z" }, now)).toBe(true);
  });
});

describe("isJobUnassigned", () => {
  it("is true for a non-terminal job with zero active assignments", () => {
    expect(isJobUnassigned({ status: "scheduled", activeAssignmentCount: 0 })).toBe(true);
  });

  it("is false for a non-terminal job with active assignments", () => {
    expect(isJobUnassigned({ status: "scheduled", activeAssignmentCount: 2 })).toBe(false);
  });

  it("is false for a terminal (completed) job with zero assignments", () => {
    expect(isJobUnassigned({ status: "completed", activeAssignmentCount: 0 })).toBe(false);
  });

  it("is false for a terminal (cancelled) job with zero assignments", () => {
    expect(isJobUnassigned({ status: "cancelled", activeAssignmentCount: 0 })).toBe(false);
  });

  it("is true for an unscheduled job with zero assignments (unscheduled is non-terminal)", () => {
    expect(isJobUnassigned({ status: "unscheduled", activeAssignmentCount: 0 })).toBe(true);
  });
});

describe("isJobUnscheduledActive", () => {
  it("is true only for status === 'unscheduled'", () => {
    expect(isJobUnscheduledActive({ status: "unscheduled" })).toBe(true);
  });

  it("is false for every other status", () => {
    for (const status of jobStatuses) {
      if (status === "unscheduled") continue;
      expect(isJobUnscheduledActive({ status })).toBe(false);
    }
  });
});

describe("jobNeedsAttention", () => {
  const now = new Date("2026-07-28T12:00:00.000Z");

  it("is true when only overdue", () => {
    expect(
      jobNeedsAttention(
        { status: "scheduled", scheduledStart: new Date("2026-07-28T09:00:00.000Z"), activeAssignmentCount: 1 },
        now
      )
    ).toBe(true);
  });

  it("is true when only unassigned", () => {
    expect(
      jobNeedsAttention(
        { status: "scheduled", scheduledStart: new Date("2026-07-29T09:00:00.000Z"), activeAssignmentCount: 0 },
        now
      )
    ).toBe(true);
  });

  it("is true when only unscheduled", () => {
    expect(
      jobNeedsAttention({ status: "unscheduled", scheduledStart: null, activeAssignmentCount: 0 }, now)
    ).toBe(true);
  });

  it("is true (not double-counted, still a single boolean) when a job matches multiple predicates at once", () => {
    // Overdue AND unassigned simultaneously: scheduled, in the past, zero assignments.
    const job = {
      status: "scheduled",
      scheduledStart: new Date("2026-07-28T09:00:00.000Z"),
      activeAssignmentCount: 0,
    };
    expect(isJobOverdue(job, now)).toBe(true);
    expect(isJobUnassigned(job)).toBe(true);
    // The combined predicate is still just `true` — proving a caller using this
    // as a boolean OR filter (not summing three separate predicate counts)
    // counts this job exactly once, not twice.
    expect(jobNeedsAttention(job, now)).toBe(true);
  });

  it("is false for a completed job with no assignments and no scheduledStart concerns", () => {
    expect(
      jobNeedsAttention(
        { status: "completed", scheduledStart: new Date("2026-01-01T00:00:00.000Z"), activeAssignmentCount: 0 },
        now
      )
    ).toBe(false);
  });

  it("is false for a healthy in-progress job: future start, has assignments", () => {
    expect(
      jobNeedsAttention(
        { status: "dispatched", scheduledStart: new Date("2026-07-29T09:00:00.000Z"), activeAssignmentCount: 1 },
        now
      )
    ).toBe(false);
  });
});
