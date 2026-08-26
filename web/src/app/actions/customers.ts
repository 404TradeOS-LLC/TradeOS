"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch, ApiClientError } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export type FormActionState = { error?: string } | undefined;

export async function createCustomerAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const billingAddress = String(formData.get("billingAddress") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "Name is required." };

  try {
    await apiFetch("/api/v1/customers", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        name,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        billingAddress: billingAddress || undefined,
        notes: notes || undefined,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomerAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("customerId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const billingAddress = String(formData.get("billingAddress") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "Name is required." };

  try {
    await apiFetch(`/api/v1/customers/${id}`, {
      method: "PATCH",
      token: token ?? undefined,
      body: JSON.stringify({
        name,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        billingAddress: billingAddress || undefined,
        notes: notes || undefined,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect("/customers");
}

export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = String(formData.get("customerId") ?? "");

  await apiFetch(`/api/v1/customers/${id}`, { method: "DELETE", token: token ?? undefined });

  revalidatePath("/customers");
  redirect("/customers");
}
