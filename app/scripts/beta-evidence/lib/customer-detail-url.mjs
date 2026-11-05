// Only a persisted Customer detail route may satisfy the create-customer
// browser checkpoint. /customers/new is the form, not a created Customer.
const CUSTOMER_DETAIL_PATH = /^\/customers\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\/?$/i;

export function createdCustomerIdFromUrl(value) {
  try {
    return CUSTOMER_DETAIL_PATH.exec(new URL(String(value)).pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}
