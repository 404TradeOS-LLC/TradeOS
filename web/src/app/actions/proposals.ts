"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch, ApiClientError, Proposal } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { FormActionState } from "./customers";

function readPaymentSchedule(formData: FormData) {
  const schedule = [0, 1, 2]
    .map((index) => {
      const label = String(formData.get(`paymentLabel${index}`) ?? "").trim();
      const amountPercentRaw = String(formData.get(`paymentPercent${index}`) ?? "").trim();
      const notes = String(formData.get(`paymentNotes${index}`) ?? "").trim();
      const amountPercent = amountPercentRaw ? Number(amountPercentRaw) : NaN;

      if (!label && !amountPercentRaw && !notes) return null;
      if (!label || Number.isNaN(amountPercent)) return { invalid: true as const };

      return {
        label,
        amountPercent,
        ...(notes ? { notes } : {}),
      };
    })
    .filter((entry) => entry !== null);

  if (schedule.some((entry) => "invalid" in entry)) {
    return { error: "Each payment row needs a label and percent." };
  }

  return {
    value: schedule.length ? schedule : undefined,
  };
}

export async function createProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const estimateId = String(formData.get("estimateId") ?? "");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const showLineItemDetail = formData.get("showLineItemDetail") === "on";
  const scopeOfWork = String(formData.get("scopeOfWork") ?? "").trim();
  const assumptions = String(formData.get("assumptions") ?? "").trim();
  const exclusions = String(formData.get("exclusions") ?? "").trim();
  const timeline = String(formData.get("timeline") ?? "").trim();
  const termsAndConditions = String(formData.get("termsAndConditions") ?? "").trim();
  const paymentSchedule = readPaymentSchedule(formData);

  if ("error" in paymentSchedule) {
    return { error: paymentSchedule.error };
  }

  let proposal: Proposal;
  try {
    proposal = await apiFetch<Proposal>("/api/v1/proposals", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        estimateId: estimateId || undefined,
        projectId: projectId || undefined,
        companyName: companyName || undefined,
        showLineItemDetail,
        scopeOfWork: scopeOfWork || undefined,
        assumptions: assumptions || undefined,
        exclusions: exclusions || undefined,
        timeline: timeline || undefined,
        paymentScheduleJson: paymentSchedule.value,
        termsAndConditions: termsAndConditions || undefined,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/proposals/${proposal.id}`);
}

export async function updateProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const scopeOfWork = String(formData.get("scopeOfWork") ?? "").trim();
  const assumptions = String(formData.get("assumptions") ?? "").trim();
  const exclusions = String(formData.get("exclusions") ?? "").trim();
  const timeline = String(formData.get("timeline") ?? "").trim();
  const termsAndConditions = String(formData.get("termsAndConditions") ?? "").trim();
  const priceLowRaw = String(formData.get("priceLow") ?? "").trim();
  const priceHighRaw = String(formData.get("priceHigh") ?? "").trim();
  const finalPriceRaw = String(formData.get("finalPrice") ?? "").trim();
  const paymentSchedule = readPaymentSchedule(formData);

  if ("error" in paymentSchedule) {
    return { error: paymentSchedule.error };
  }

  try {
    await apiFetch(`/api/v1/proposals/${proposalId}`, {
      method: "PATCH",
      token: token ?? undefined,
      body: JSON.stringify({
        companyName: companyName || undefined,
        scopeOfWork: scopeOfWork || undefined,
        assumptions: assumptions || undefined,
        exclusions: exclusions || undefined,
        timeline: timeline || undefined,
        termsAndConditions: termsAndConditions || undefined,
        priceLow: priceLowRaw ? Number(priceLowRaw) : null,
        priceHigh: priceHighRaw ? Number(priceHighRaw) : null,
        finalPrice: finalPriceRaw ? Number(finalPriceRaw) : null,
        paymentScheduleJson: paymentSchedule.value,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`);
  redirect(`/projects/${projectId}/proposals/${proposalId}`);
}

export async function sendProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  try {
    await apiFetch(`/api/v1/proposals/${id}/send`, { method: "POST", token: token ?? undefined });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function resendProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  try {
    await apiFetch(`/api/v1/proposals/${id}/resend`, { method: "POST", token: token ?? undefined });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function markProposalViewedAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const portal = String(formData.get("portal") ?? "") === "true";

  try {
    await apiFetch(`/api/v1/proposals/${id}/mark-viewed`, { method: "POST", token: token ?? undefined });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  if (portal) {
    redirect(`/portal/proposals/${id}`);
  }
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function markProposalViewedSubmit(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const portal = String(formData.get("portal") ?? "") === "true";

  await apiFetch(`/api/v1/proposals/${id}/mark-viewed`, { method: "POST", token: token ?? undefined });

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  if (portal) {
    redirect(`/portal/proposals/${id}`);
  }
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function acceptProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const portal = String(formData.get("portal") ?? "") === "true";

  try {
    await apiFetch(`/api/v1/proposals/${id}/accept`, { method: "POST", token: token ?? undefined });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  if (portal) {
    redirect(`/portal/projects/${projectId}`);
  }
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function acceptProposalSubmit(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const portal = String(formData.get("portal") ?? "") === "true";

  await apiFetch(`/api/v1/proposals/${id}/accept`, { method: "POST", token: token ?? undefined });

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  if (portal) {
    redirect(`/portal/projects/${projectId}`);
  }
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function rejectProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const portal = String(formData.get("portal") ?? "") === "true";

  try {
    await apiFetch(`/api/v1/proposals/${id}/reject`, { method: "POST", token: token ?? undefined });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${id}`);
  if (portal) {
    redirect(`/portal/projects/${projectId}`);
  }
  redirect(`/projects/${projectId}/proposals/${id}`);
}

export async function duplicateProposalAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  let proposal: Proposal;
  try {
    proposal = await apiFetch<Proposal>(`/api/v1/proposals/${id}/duplicate`, {
      method: "POST",
      token: token ?? undefined,
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/proposals/${proposal.id}`);
}
