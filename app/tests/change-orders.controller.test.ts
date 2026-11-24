import { changeOrdersController } from "../backend/controllers/changeOrders.controller";
import { ChangeOrdersService } from "../modules/change-orders/service";

jest.mock("../modules/change-orders/service", () => ({
  ChangeOrdersService: jest.fn().mockImplementation(() => ({
    approve: jest.fn(),
    reject: jest.fn(),
  })),
}));

// The controller instantiates its service once at import time; capture that
// instance here (same pattern as s041.authorization.controller.test.ts).
// Hold the reference directly: jest.clearAllMocks() wipes the constructor
// mock's recorded results, so re-reading mock.results[0] in a test would
// come back undefined.
const serviceInstance = (ChangeOrdersService as jest.Mock).mock.results[0].value as {
  approve: jest.Mock;
  reject: jest.Mock;
};

function requestFor(role: string | null) {
  return {
    ...(role === null ? {} : { auth: { userId: "user-1", orgId: "org-1", role } }),
    orgId: "org-1",
    params: { id: "co-1" },
    body: {},
  } as never;
}

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe("S068 change-order approve/reject controller authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("denies technician approve/reject before the service layer", async () => {
    await expect(changeOrdersController.approve(requestFor("technician"), response() as never)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(changeOrdersController.reject(requestFor("technician"), response() as never)).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(serviceInstance.approve).not.toHaveBeenCalled();
    expect(serviceInstance.reject).not.toHaveBeenCalled();
  });

  it("denies unauthenticated approve/reject with 401", async () => {
    await expect(changeOrdersController.approve(requestFor(null), response() as never)).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(changeOrdersController.reject(requestFor(null), response() as never)).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(serviceInstance.approve).not.toHaveBeenCalled();
    expect(serviceInstance.reject).not.toHaveBeenCalled();
  });

  it("passes the authenticated user id through as the decision actor", async () => {
    const approveResponse = response();
    const rejectResponse = response();
    serviceInstance.approve.mockResolvedValue({ id: "co-1", status: "approved" });
    serviceInstance.reject.mockResolvedValue({ id: "co-1", status: "rejected" });

    await changeOrdersController.approve(requestFor("owner"), approveResponse as never);
    await changeOrdersController.reject(requestFor("dispatcher"), rejectResponse as never);

    expect(serviceInstance.approve).toHaveBeenCalledWith("co-1", "org-1", "user-1");
    expect(serviceInstance.reject).toHaveBeenCalledWith("co-1", "org-1", "user-1");
    expect(approveResponse.json).toHaveBeenCalledWith({ id: "co-1", status: "approved" });
    expect(rejectResponse.json).toHaveBeenCalledWith({ id: "co-1", status: "rejected" });
  });
});
