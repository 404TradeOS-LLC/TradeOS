"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch, ApiClientError, Contract } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { FormActionState } from "./customers";

export async function createContractAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const proposalId = String(formData.get("proposalId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  let contract: Contract;
  try {
    contract = await apiFetch<Contract>("/api/v1/contracts", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({ proposalId }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`);
  redirect(`/projects/${projectId}/contracts/${contract.id}`);
}

export async function signContractAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("contractId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const signerName = String(formData.get("signerName") ?? "").trim();
  const signerEmail = String(formData.get("signerEmail") ?? "").trim();
  const signatureDataUrl = String(formData.get("signatureDataUrl") ?? "").trim();
  const portal = String(formData.get("portal") ?? "") === "true";

  if (!signerName) return { error: "Signer name is required." };

  try {
    await apiFetch(`/api/v1/contracts/${id}/sign`, {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({ signerName, signerEmail: signerEmail || undefined, signatureDataUrl: signatureDataUrl || undefined }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}/contracts/${id}`);
  if (portal) {
    redirect(`/portal/contracts/${id}`);
  }
  redirect(`/projects/${projectId}/contracts/${id}`);
}

export async function voidContractAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = String(formData.get("contractId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  await apiFetch(`/api/v1/contracts/${id}/void`, { method: "POST", token: token ?? undefined });

  revalidatePath(`/projects/${projectId}/contracts/${id}`);
  redirect(`/projects/${projectId}/contracts/${id}`);
}
