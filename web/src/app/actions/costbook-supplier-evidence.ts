"use server";

import { revalidatePath } from "next/cache";
import { reviewRegionalSupplierCanonicalMatch } from "@/lib/costbook-api";
import { parseSupplierCanonicalMatchReview } from "@/lib/costbook-supplier-review";
import { getSessionToken } from "@/lib/session";

const SUPPLIER_EVIDENCE_PATH = "/costbook/supplier-evidence";


export async function reviewSupplierCanonicalMatchAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  if (!token) {
    throw new Error("You need to be signed in to review supplier evidence.");
  }

  const input = parseSupplierCanonicalMatchReview(formData);
  await reviewRegionalSupplierCanonicalMatch(
    token,
    input.supplierProductId,
    input.canonicalMaterialKey
  );

  revalidatePath(SUPPLIER_EVIDENCE_PATH);
  revalidatePath("/costbook");
}
