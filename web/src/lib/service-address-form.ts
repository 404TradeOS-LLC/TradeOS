export function parseServiceAddressForm(formData: FormData) {
  const input = {
    label: String(formData.get("label") ?? "").trim(),
    addressLine1: String(formData.get("addressLine1") ?? "").trim(),
    addressLine2: String(formData.get("addressLine2") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    postalCode: String(formData.get("postalCode") ?? "").trim(),
    isPrimary: formData.get("isPrimary") === "on",
  };
  if (!input.addressLine1 || !input.city || !input.state || !input.postalCode) {
    return { error: "Street, city, state, and postal code are required." } as const;
  }
  return { input } as const;
}
