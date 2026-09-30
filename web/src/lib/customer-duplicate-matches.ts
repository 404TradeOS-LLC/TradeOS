import type { Customer } from "@/lib/api";

export type CustomerDuplicateField = "name" | "email";

export interface CustomerDuplicateMatch {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  matchedOn: CustomerDuplicateField[];
}

export interface CustomerDuplicateInput {
  name: string;
  email: string;
  phone: string;
}

export function customerDuplicateSearchTerms(input: CustomerDuplicateInput): string[] {
  return [...new Set([input.name.trim(), input.email.trim()].filter((term) => term.length > 0 && term.length <= 320))];
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

export function findCustomerDuplicateMatches(
  customers: Customer[],
  input: CustomerDuplicateInput
): CustomerDuplicateMatch[] {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  const matches = new Map<string, CustomerDuplicateMatch>();

  for (const customer of customers) {
    const matchedOn: CustomerDuplicateField[] = [];
    if (name && normalizeName(customer.name) === name) matchedOn.push("name");
    if (email && normalizeEmail(customer.email) === email) matchedOn.push("email");
    if (matchedOn.length === 0) continue;

    const prior = matches.get(customer.id);
    matches.set(customer.id, {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      matchedOn: prior ? [...new Set([...prior.matchedOn, ...matchedOn])] : matchedOn,
    });
  }

  return [...matches.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function requiresSeparateCustomerConfirmation(matchCount: number, explicitlyCreateSeparate: boolean): boolean {
  return matchCount > 0 && !explicitlyCreateSeparate;
}

/** A full search page may hide an exact match on the next page. */
export function isCustomerMatchLookupIncomplete(
  results: PromiseSettledResult<Customer[]>[],
  pageLimit: number
): boolean {
  return results.some((result) => result.status === "rejected" || result.value.length >= pageLimit);
}
