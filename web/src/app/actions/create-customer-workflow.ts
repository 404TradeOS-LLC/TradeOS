import {
  customerDuplicateSearchTerms,
  findCustomerDuplicateMatches,
  requiresSeparateCustomerConfirmation,
  type CustomerDuplicateInput,
} from "../../lib/customer-duplicate-matches.ts";
import type { Customer } from "../../lib/api";

export type CreateCustomerResult = {
  error?: string;
  customerInput?: CustomerDuplicateInput;
  customerMatches?: ReturnType<typeof findCustomerDuplicateMatches>;
  customerMatchLookupFailed?: boolean;
} | undefined;

type CustomerCreateInput = CustomerDuplicateInput & {
  address: string;
  billingAddress: string;
  notes: string;
};

export type CreateCustomerDependencies = {
  getSessionToken: () => Promise<string | null>;
  listCustomers: (token: string, options: { query: string; limit: number }) => Promise<Customer[]>;
  createCustomer: (token: string, input: CustomerCreateInput) => Promise<void>;
  onCreated: () => void;
  onError: (error: unknown) => string;
};

export async function runCreateCustomerWorkflow(
  formData: FormData,
  dependencies: CreateCustomerDependencies,
): Promise<CreateCustomerResult> {
  const token = await dependencies.getSessionToken();
  const customerInput = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
  };
  const address = String(formData.get("address") ?? "").trim();
  const billingAddress = String(formData.get("billingAddress") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const intent = String(formData.get("intent") ?? "create");

  if (!customerInput.name) return { error: "Name is required.", customerInput };
  if (!token) return { error: "Sign in again before searching or creating a customer.", customerInput };

  const searchTerms = customerDuplicateSearchTerms(customerInput);
  const searchResults = await Promise.allSettled(searchTerms.map((query) => dependencies.listCustomers(token, { query, limit: 250 })));
  const candidates = searchResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const customerMatches = findCustomerDuplicateMatches(candidates, customerInput);
  const customerMatchLookupFailed = searchResults.some((result) =>
    result.status === "rejected" || (result.status === "fulfilled" && result.value.length >= 250)
  );

  if (intent === "check") return { customerInput, customerMatches, customerMatchLookupFailed };
  if (customerMatchLookupFailed) {
    return {
      error: "Customer search is incomplete. Retry the search before creating this customer.",
      customerInput,
      customerMatches,
      customerMatchLookupFailed: true,
    };
  }
  if (intent !== "create-separate" && requiresSeparateCustomerConfirmation(customerMatches.length, false)) {
    return { customerInput, customerMatches, customerMatchLookupFailed };
  }

  try {
    await dependencies.createCustomer(token, { ...customerInput, address, billingAddress, notes });
  } catch (error) {
    return { error: dependencies.onError(error), customerInput };
  }

  dependencies.onCreated();
  return undefined;
}
