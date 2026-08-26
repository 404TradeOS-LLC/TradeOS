"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export type FieldActionState = { error?: string } | undefined;

const TRANSITIONS = {
  startTravel: "start-travel",
  arrive: "arrive",
  pause: "pause",
  resume: "resume",
  complete: "complete",
} as const;

type FieldTransition = keyof typeof TRANSITIONS;

export async function transitionFieldJobAction(_previous: FieldActionState, formData: FormData): Promise<FieldActionState> {
  const token = await getSessionToken();
  const jobId = String(formData.get("jobId") ?? "").trim();
  const transition = String(formData.get("transition") ?? "") as FieldTransition;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!token) return { error: "Authentication is required." };
  if (!jobId || !(transition in TRANSITIONS)) return { error: "Choose a valid job action." };
  if (transition === "pause" && !reason) return { error: "Add a reason before pausing the job." };

  try {
    await apiFetch(`/api/v1/jobs/${jobId}/${TRANSITIONS[transition]}`, {
      method: "POST",
      token,
      body: JSON.stringify(reason ? { reason } : {}),
    });
  } catch (error) {
    return { error: error instanceof ApiClientError ? error.message : "Unable to update this job." };
  }

  revalidatePath("/field");
  redirect(`/field?job=${encodeURIComponent(jobId)}&updated=1`);
}

export async function addFieldJobNoteAction(_previous: FieldActionState, formData: FormData): Promise<FieldActionState> {
  const token = await getSessionToken();
  const jobId = String(formData.get("jobId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!token) return { error: "Authentication is required." };
  if (!jobId || !body) return { error: "Write a note before saving." };
  if (body.length > 5_000) return { error: "Keep notes to 5,000 characters or fewer." };

  try {
    await apiFetch(`/api/v1/jobs/${jobId}/notes`, {
      method: "POST",
      token,
      body: JSON.stringify({ body }),
    });
  } catch (error) {
    return { error: error instanceof ApiClientError ? error.message : "Unable to save this note." };
  }

  revalidatePath("/field");
  redirect(`/field?job=${encodeURIComponent(jobId)}&updated=1`);
}
