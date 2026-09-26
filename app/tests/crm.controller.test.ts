import { Request, Response } from "express";

const createCustomerMock = jest.fn();
const listCustomersMock = jest.fn();
const getCustomerMock = jest.fn();
const updateCustomerMock = jest.fn();
const removeCustomerMock = jest.fn();
const addServiceAddressMock = jest.fn();
const updateServiceAddressMock = jest.fn();
const removeServiceAddressMock = jest.fn();
const recordMock = jest.fn();

jest.mock("../modules/crm/service", () => ({
  CrmService: jest.fn().mockImplementation(() => ({
    listCustomers: listCustomersMock,
    createCustomer: createCustomerMock,
    getCustomer: getCustomerMock,
    updateCustomer: updateCustomerMock,
    removeCustomer: removeCustomerMock,
    addServiceAddress: addServiceAddressMock,
    updateServiceAddress: updateServiceAddressMock,
    removeServiceAddress: removeServiceAddressMock,
    addEquipment: jest.fn(),
    updateEquipment: jest.fn(),
    removeEquipment: jest.fn(),
    listServiceAgreements: jest.fn(),
    createServiceAgreement: jest.fn(),
    listNotes: jest.fn(),
    createNote: jest.fn(),
    importCustomers: jest.fn(),
    getCompanyProfile: jest.fn(),
    upsertCompanyProfile: jest.fn(),
    listPayments: jest.fn(),
    createPayment: jest.fn(),
  })),
}));

jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({
    record: recordMock,
  })),
}));

import { crmCustomersController } from "../backend/controllers/crm.controller";

function buildResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

function buildRequest(body: unknown, role = "dispatcher", query: Record<string, unknown> = {}) {
  return {
    body,
    query,
    params: { id: "customer-1", addressId: "address-1" },
    orgId: "org-1",
    auth: { userId: "user-1", orgId: "org-1", role, canonicalRole: role },
  } as unknown as Request;
}

describe("crmCustomersController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("records an activity event when a customer is created", async () => {
    createCustomerMock.mockResolvedValue({
      id: "customer-1",
      name: "Acme Industries",
    });
    recordMock.mockResolvedValue({});

    const req = buildRequest({ name: "Acme Industries" });
    const res = buildResponse();

    await crmCustomersController.create(req, res);

    expect(createCustomerMock).toHaveBeenCalledWith("org-1", { name: "Acme Industries" });
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        entityType: "customer",
        entityId: "customer-1",
        eventType: "customer.created",
        actorUserId: "user-1",
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("passes bounded customer search through the authenticated organization scope", async () => {
    listCustomersMock.mockResolvedValue([{ id: "customer-1", name: "Smith Family" }]);
    const response = buildResponse();

    await crmCustomersController.list(buildRequest({}, "admin", { query: " Smith ", limit: "25" }), response);

    expect(listCustomersMock).toHaveBeenCalledWith("org-1", { query: "Smith", limit: 25 });
    expect(response.json).toHaveBeenCalledWith([{ id: "customer-1", name: "Smith Family" }]);
  });

  it("rejects invalid customer search bounds before reading CRM data", async () => {
    await expect(crmCustomersController.list(buildRequest({}, "admin", { query: " ", limit: "251" }), buildResponse())).rejects.toBeDefined();
    expect(listCustomersMock).not.toHaveBeenCalled();
  });

  it("allows owner/admin/dispatcher to create and update customers using crm.write", async () => {
    createCustomerMock.mockResolvedValue({ id: "customer-1", name: "Acme" });
    updateCustomerMock.mockResolvedValue({ id: "customer-1", name: "Updated" });
    recordMock.mockResolvedValue({});
    for (const role of ["owner", "admin", "dispatcher"]) {
      await crmCustomersController.create(buildRequest({ name: "Acme" }, role), buildResponse());
      await crmCustomersController.update(buildRequest({ name: "Updated" }, role), buildResponse());
    }
    expect(createCustomerMock).toHaveBeenCalledTimes(3);
    expect(updateCustomerMock).toHaveBeenCalledTimes(3);
  });

  it("keeps the technician customer and address write boundary closed", async () => {
    await expect(crmCustomersController.create(buildRequest({ name: "Acme" }, "technician"), buildResponse())).rejects.toMatchObject({ statusCode: 403 });
    await expect(crmCustomersController.update(buildRequest({ name: "Acme" }, "technician"), buildResponse())).rejects.toMatchObject({ statusCode: 403 });
    await expect(crmCustomersController.addServiceAddress(buildRequest({ addressLine1: "1 Main", city: "Terre Haute", state: "IN", postalCode: "47802" }, "technician"), buildResponse())).rejects.toMatchObject({ statusCode: 403 });
    expect(createCustomerMock).not.toHaveBeenCalled();
    expect(addServiceAddressMock).not.toHaveBeenCalled();
  });

  it("allows admin to create, edit and remove an existing CRM service address", async () => {
    const input = { addressLine1: "1 Main", city: "Terre Haute", state: "IN", postalCode: "47802" };
    addServiceAddressMock.mockResolvedValue({ id: "address-1", ...input });
    updateServiceAddressMock.mockResolvedValue({ id: "address-1", ...input });
    removeServiceAddressMock.mockResolvedValue(undefined);
    const request = buildRequest(input, "admin");
    await crmCustomersController.addServiceAddress(request, buildResponse());
    await crmCustomersController.updateServiceAddress(request, buildResponse());
    await crmCustomersController.removeServiceAddress(request, buildResponse());
    expect(addServiceAddressMock).toHaveBeenCalledWith("org-1", "customer-1", input);
    expect(updateServiceAddressMock).toHaveBeenCalledWith("org-1", "customer-1", "address-1", input);
    expect(removeServiceAddressMock).toHaveBeenCalledWith("org-1", "customer-1", "address-1");
  });

  it("rejects invalid address fields before calling the service", async () => {
    await expect(crmCustomersController.addServiceAddress(buildRequest({ addressLine1: "", city: "Terre Haute" }, "admin"), buildResponse())).rejects.toBeDefined();
    expect(addServiceAddressMock).not.toHaveBeenCalled();
  });
});
