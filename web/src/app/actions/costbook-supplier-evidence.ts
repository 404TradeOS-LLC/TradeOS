"use server";

import { revalidatePath } from "next/cache";
import { reviewRegionalSupplierCanonicalMatch } from "@/lib/costbook-api";
import { getSessionToken } from "@/lib/session";

const SUPPLIER_EVIDENCE_PATH = "/costbook/supplier-evidence";

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

export async function reviewSupplierCanonicalMatchAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  if (!token) {
    throw new Error("You need to be signed in to review supplier evidence.");
  }

  await reviewRegionalSupplierCanonicalMatch(
    token,
    requiredString(formData, "supplierProductId"),
    requiredString(formData, "canonicalMaterialKey")
  );

  revalidatePath(SUPPLIER_EVIDENCE_PATH);
  revalidatePath("/costbook");
}
