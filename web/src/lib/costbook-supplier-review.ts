export interface SupplierCanonicalMatchReviewInput {
  supplierProductId: string;
  canonicalMaterialKey: string;
}

function requiredFormString(formData: Pick<FormData, "get">, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

export function parseSupplierCanonicalMatchReview(
  formData: Pick<FormData, "get">
): SupplierCanonicalMatchReviewInput {
  return {
    supplierProductId: requiredFormString(formData, "supplierProductId"),
    canonicalMaterialKey: requiredFormString(formData, "canonicalMaterialKey"),
  };
}
