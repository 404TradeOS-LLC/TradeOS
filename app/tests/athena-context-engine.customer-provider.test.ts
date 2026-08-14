import { assertValidProviderDefinition } from "../modules/athena-context-engine/registry";
import { assertValidContextProviderFetchResult } from "../modules/athena-context-engine/resultValidation";
import { createCustomerProvider } from "../modules/athena-context-engine/providers/customerProvider";
import type { CrmService } from "../modules/crm/service";

function baseInput(overrides: Partial<{ orgId: string; actor: { userId: string; role: "owner" | "admin" | "dispatcher" | "technician" }; selectedScope: Record<string, string> }> = {}) {
  return {
    orgId: "org-1",
    actor: { userId: "user-1", role: "owner" as const },
    selectedScope: {},
    deadline: new Date(Date.now() + 5_000),
    cancellationSignal: new AbortController().signal,
    ...overrides,
  };
}

describe("customer context provider", () => {
  it("is a valid provider definition", () => {
    const provider = createCustomerProvider();
    expect(() => assertValidProviderDefinition(provider)).not.toThrow();
    expect(provider.section).toBe("customers");
  });

  it("uses an exact customer lookup when selectedScope.customerId is present", async () => {
    let listCalled = false;
    let captured: { orgId: string; customerId: string } | undefined;
    const crmService: Pick<CrmService, "getCustomer" | "listCustomers"> = {
      async getCustomer(orgId, customerId) {
        captured = { orgId, customerId };
        return {
          id: customerId,
          name: "Ada Lovelace",
          email: "ada@example.com",
          phone: "555-1234",
          projects: [{ id: "project-1" }],
          serviceAddresses: [{ id: "address-1" }],
          equipmentAssets: [{ id: "equipment-1" }],
        } as never;
      },
      async listCustomers() {
        listCalled = true;
        return [];
      },
    };
    const provider = createCustomerProvider({}, crmService);

    const result = await provider.provide(baseInput({ selectedScope: { customerId: "customer-1" } }));

    expect(() => assertValidContextProviderFetchResult(result)).not.toThrow();
    expect(listCalled).toBe(false);
    expect(captured).toEqual({ orgId: "org-1", customerId: "customer-1" });
    expect(result.data.customers[0]).toMatchObject({
      customerId: "customer-1",
      name: "Ada Lovelace",
      projectCount: 1,
      serviceAddressCount: 1,
      equipmentCount: 1,
    });
  });

  it("returns a narrow customer list when no exact scope is supplied", async () => {
    const crmService: Pick<CrmService, "getCustomer" | "listCustomers"> = {
      async getCustomer() {
        throw new Error("unexpected getCustomer");
      },
      async listCustomers(orgId, options) {
        expect(orgId).toBe("org-1");
        expect(options).toBeDefined();
        expect(options?.limit).toBe(10);
        return [
          { id: "customer-1", name: "Ada Lovelace", email: "ada@example.com", phone: "555-1234" },
          { id: "customer-2", name: "Grace Hopper", email: null, phone: null },
        ] as never;
      },
    };
    const provider = createCustomerProvider({}, crmService);

    const result = await provider.provide(baseInput());

    expect(result.data.total).toBe(2);
    expect(result.itemCount).toBe(2);
    expect(result.omittedFields).toContain("serviceAddresses");
  });
});
