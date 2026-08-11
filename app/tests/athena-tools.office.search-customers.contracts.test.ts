import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createCustomerSearchTool } from "../modules/athena-tools/office/searchCustomers.tool";
import type { CustomerSearchToolDeps } from "../modules/athena-tools/office/searchCustomers.tool";
import type { CrmService } from "../modules/crm/service";

const VALID_CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";

type CustomerRow = Awaited<ReturnType<CrmService["listCustomers"]>>[number];
type CustomerDetail = Awaited<ReturnType<CrmService["getCustomer"]>>;

function fakeCustomerRow(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: VALID_CUSTOMER_ID,
    orgId: "org-1",
    name: "Jane Contractor",
    email: "jane@example.com",
    phone: "555-1234",
    address: "123 Main St",
    billingAddress: null,
    notes: null,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function createFakeCrm(): CustomerSearchToolDeps["crm"] {
  const rows = [
    fakeCustomerRow(),
    fakeCustomerRow({ id: "33333333-3333-4333-8333-333333333333", name: "Bob Builder", email: "bob@example.com", phone: "555-5678" }),
  ];
  return {
    listCustomers: jest.fn(async (_orgId: string, options = {}): Promise<CustomerRow[]> => {
      const query = options.query?.trim().toLowerCase();
      const matches = query
        ? rows.filter((customer) => [customer.name, customer.email, customer.phone].some((value) => value?.toLowerCase().includes(query)))
        : rows;
      return matches.slice(0, options.limit ?? matches.length);
    }),
    getCustomer: jest.fn(
      async (_orgId: string, customerId: string): Promise<CustomerDetail> => ({
        ...fakeCustomerRow({ id: customerId }),
        notes: [],
        projects: [],
        serviceAddresses: [],
        equipmentAssets: [],
      })
    ),
  };
}

describe("athena-tools office: search-customers", () => {
  describeAthenaToolContract(createCustomerSearchTool({ crm: createFakeCrm() }), {
    validInput: { query: "Jane" },
    invalidInputs: [{}, { customerId: "not-a-uuid" }, { query: "" }],
  });

  it("looks up a single customer by customerId, preferring it over query", async () => {
    const crm = createFakeCrm();
    const tool = createCustomerSearchTool({ crm });
    const result = await tool.execute(
      { customerId: VALID_CUSTOMER_ID, query: "irrelevant" },
      {} as never,
      { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(crm.getCustomer).toHaveBeenCalledWith("org-1", VALID_CUSTOMER_ID);
    expect(crm.listCustomers).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data?.customers).toEqual([{ id: VALID_CUSTOMER_ID, name: "Jane Contractor", email: "jane@example.com", phone: "555-1234", address: "123 Main St" }]);
  });

  it.each([
    ["name", "bob", "Bob Builder"],
    ["email", "jane@example", "Jane Contractor"],
    ["phone", "555-5678", "Bob Builder"],
  ])("passes bounded %s search to CrmService", async (_field, query, expectedName) => {
    const crm = createFakeCrm();
    const tool = createCustomerSearchTool({ crm });
    const result = await tool.execute(
      { query },
      {} as never,
      { executionId: `exec-${_field}`, requestId: `req-${_field}`, traceId: `trace-${_field}`, orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(crm.listCustomers).toHaveBeenCalledWith("org-1", { query, limit: 25 });
    expect(result.success).toBe(true);
    expect(result.data?.customers).toHaveLength(1);
    expect(result.data?.customers[0].name).toBe(expectedName);
  });
});
