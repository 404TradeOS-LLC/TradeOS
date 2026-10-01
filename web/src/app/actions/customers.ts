"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch, ApiClientError, listCustomers } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { parseServiceAddressForm } from "@/lib/service-address-form";
import { runCreateCustomerWorkflow, type CreateCustomerResult } from "./create-customer-workflow";

export type FormActionState = CreateCustomerResult;

async function mutateServiceAddress(method: "POST" | "PATCH" | "DELETE", formData: FormData): Promise<FormActionState> {
  const customerId = String(formData.get("customerId") ?? "");
  const addressId = String(formData.get("addressId") ?? "");
  if (!customerId || (method !== "POST" && !addressId)) return { error: "Service address is missing." };

  const parsed = method === "DELETE" ? undefined : parseServiceAddressForm(formData);
  if (parsed && "error" in parsed) return { error: parsed.error };
  const input = parsed?.input;

  try {
    const token = await getSessionToken();
    await apiFetch(`/api/v1/customers/${encodeURIComponent(customerId)}/service-addresses${addressId ? `/${encodeURIComponent(addressId)}` : ""}`, {
      method,
      token: token ?? undefined,
      ...(input ? { body: JSON.stringify(input) } : {}),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Could not save service address." };
  }

  revalidatePath(`/customers/${customerId}`);
  return undefined;
}

export async function createServiceAddressAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  return mutateServiceAddress("POST", formData);
}

export async function updateServiceAddressAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  return mutateServiceAddress("PATCH", formData);
}

export async function removeServiceAddressAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  return mutateServiceAddress("DELETE", formData);
}

export async function createCustomerAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  return runCreateCustomerWorkflow(formData, {
    getSessionToken,
    listCustomers,
    createCustomer: async (token, input) => {
      await apiFetch("/api/v1/customers", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: input.name,
          email: input.email || undefined,
          phone: input.phone || undefined,
          address: input.address || undefined,
          billingAddress: input.billingAddress || undefined,
          notes: input.notes || undefined,
        }),
      });
    },
    onCreated: () => {
      revalidatePath("/customers");
      redirect("/customers");
    },
    onError: (err) => err instanceof ApiClientError ? err.message : "Something went wrong.",
  });
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
