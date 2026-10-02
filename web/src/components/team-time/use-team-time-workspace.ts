"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { teamTimeRequest, type TeamTimeAction } from "@/lib/team-time-api";
import type { Shift, WorkspaceData } from "@/lib/team-time-model";

export type TeamTimeMode = "myday" | "review" | "team" | "handoff";

const ACTION_NOTICES: Partial<Record<TeamTimeAction, string>> = {
  clock_in: "Clocked in to the assigned job.", break_start: "Break started.", break_end: "Break ended.",
  clock_out: "Clocked out. The shift is ready for review.", correct: "Correction saved for manager review.",
  approve: "Hours approved.", reopen: "Hours returned to review.", configure_profile: "Worker type saved.",
};

export function useTeamTimeWorkspace() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [orgId, setOrgId] = useState("");
  const [mode, setMode] = useState<TeamTimeMode>("myday");
  const [jobId, setJobId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Shift | null>(null);
  const correctionTrigger = useRef<HTMLButtonElement | null>(null);
  const loadSequence = useRef(0);

  const load = useCallback(async (selectedOrg = "") => {
    const sequence = ++loadSequence.current;
    try {
      const result = await teamTimeRequest<WorkspaceData>("bootstrap", selectedOrg ? { orgId: selectedOrg } : {});
      if (sequence !== loadSequence.current) return null;
      setData(result);
      if (result.orgId) setOrgId(result.orgId);
      setJobId((current) => result.assignedJobIds?.includes(current) ? current : "");
      setError("");
      return result;
    } catch (cause) {
      if (sequence === loadSequence.current) setError(cause instanceof Error ? cause.message : "Team & Time could not load.");
      return null;
    }
  }, []);

  useEffect(() => {
    let current = true;
    // The bootstrap synchronizes the view with authenticated server data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load("").then((result) => {
      if (current && result?.supervisor && window.matchMedia("(min-width: 768px)").matches) setMode("review");
    });
    return () => { current = false; loadSequence.current += 1; };
  }, [load]);

  const act = useCallback(async (action: TeamTimeAction, details: Record<string, unknown> = {}) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await teamTimeRequest(action, { orgId, ...details });
      const refreshed = await load(orgId);
      if (!refreshed) throw new Error("Your change may have saved, but the latest hours did not reload. Refresh to confirm before retrying.");
      setNotice(ACTION_NOTICES[action] || "Saved.");
      setEditing(null); setNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change could not be saved.");
    } finally { setBusy(false); }
  }, [load, orgId]);

  return { data, setData, orgId, setOrgId, mode, setMode, jobId, setJobId, note, setNote, busy, error, setError, notice, editing, setEditing, correctionTrigger, load, act };
}
