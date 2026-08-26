import { Request, Response } from "express";

const createCustomerMock = jest.fn();
const listCustomersMock = jest.fn();
const getCustomerMock = jest.fn();
const updateCustomerMock = jest.fn();
const removeCustomerMock = jest.fn();
const recordMock = jest.fn();

jest.mock("../modules/crm/service", () => ({
  CrmService: jest.fn().mockImplementation(() => ({
    listCustomers: listCustomersMock,
    createCustomer: createCustomerMock,
    getCustomer: getCustomerMock,
    updateCustomer: updateCustomerMock,
    removeCustomer: removeCustomerMock,
    addServiceAddress: jest.fn(),
    updateServiceAddress: jest.fn(),
    removeServiceAddress: jest.fn(),
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

function buildRequest(body: unknown) {
  return {
    body,
    params: { id: "customer-1" },
    orgId: "org-1",
    auth: { userId: "user-1", orgId: "org-1", role: "dispatcher", canonicalRole: "dispatcher" },
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
});
