import { closeoutController } from "../backend/controllers/closeout.controller";
import { CloseoutService } from "../modules/closeout/service";

jest.mock("../modules/closeout/service", () => ({
  CloseoutService: jest.fn().mockImplementation(() => ({
    createCloseoutForProject: jest.fn(),
    getCloseoutByProject: jest.fn(),
    markCloseoutReady: jest.fn(),
    markCloseoutHandedOff: jest.fn(),
    getCloseoutDocumentData: jest.fn(),
    getCloseoutDocumentHtml: jest.fn(),
    createPunchItem: jest.fn(),
    listPunchItemsByProject: jest.fn(),
    getPunchItemById: jest.fn(),
    updatePunchItem: jest.fn(),
    resolvePunchItem: jest.fn(),
    verifyPunchItem: jest.fn(),
    reopenPunchItem: jest.fn(),
    createWarrantyRecord: jest.fn(),
    listWarrantyRecordsByProject: jest.fn(),
    getWarrantyRecordById: jest.fn(),
    updateWarrantyRecord: jest.fn(),
    deleteWarrantyRecord: jest.fn(),
  })),
}));

// The controller instantiates its service once at import time; capture that
// instance here (same pattern as change-orders.controller.test.ts).
const serviceInstance = (CloseoutService as jest.Mock).mock.results[0].value as Record<string, jest.Mock>;

function requestFor(role: string | null, overrides: Record<string, unknown> = {}) {
  return {
    ...(role === null ? {} : { auth: { userId: "user-1", orgId: "org-1", role } }),
    orgId: "org-1",
    params: { projectId: "project-1", id: "punch-1" },
    body: {},
    ...overrides,
  } as never;
}

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn(), setHeader: jest.fn() };
}

describe("S069 closeout controller authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("denies unauthenticated closeout, punch, and warranty calls with 401", async () => {
    await expect(closeoutController.getCloseout(requestFor(null), response() as never)).rejects.toMatchObject({ statusCode: 401 });
    await expect(closeoutController.createPunchItem(requestFor(null, { body: { title: "x" } }), response() as never)).rejects.toMatchObject({ statusCode: 401 });
    await expect(closeoutController.resolvePunchItem(requestFor(null), response() as never)).rejects.toMatchObject({ statusCode: 401 });
    await expect(closeoutController.createWarranty(requestFor(null, { body: { title: "x", coverageText: "y", sourceType: "other" } }), response() as never)).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(serviceInstance.getCloseoutByProject).not.toHaveBeenCalled();
    expect(serviceInstance.createPunchItem).not.toHaveBeenCalled();
    expect(serviceInstance.resolvePunchItem).not.toHaveBeenCalled();
    expect(serviceInstance.createWarrantyRecord).not.toHaveBeenCalled();
  });

  it("denies technician punch create/update and warranty writes before the service layer", async () => {
    await expect(closeoutController.createPunchItem(requestFor("technician", { body: { title: "x" } }), response() as never)).rejects.toMatchObject({ statusCode: 403 });
    await expect(closeoutController.updatePunchItem(requestFor("technician", { body: { title: "x" } }), response() as never)).rejects.toMatchObject({ statusCode: 403 });
    await expect(closeoutController.createWarranty(requestFor("technician", { body: { title: "x", coverageText: "y", sourceType: "other" } }), response() as never)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(closeoutController.deleteWarranty(requestFor("technician"), response() as never)).rejects.toMatchObject({ statusCode: 403 });
    expect(serviceInstance.createPunchItem).not.toHaveBeenCalled();
    expect(serviceInstance.updatePunchItem).not.toHaveBeenCalled();
    expect(serviceInstance.createWarrantyRecord).not.toHaveBeenCalled();
    expect(serviceInstance.deleteWarrantyRecord).not.toHaveBeenCalled();
  });

  it("denies technician verify/reopen and closeout ready/handoff before the service layer", async () => {
    await expect(closeoutController.verifyPunchItem(requestFor("technician"), response() as never)).rejects.toMatchObject({ statusCode: 403 });
    await expect(closeoutController.reopenPunchItem(requestFor("technician"), response() as never)).rejects.toMatchObject({ statusCode: 403 });
    await expect(closeoutController.markReady(requestFor("technician"), response() as never)).rejects.toMatchObject({ statusCode: 403 });
    await expect(closeoutController.markHandedOff(requestFor("technician"), response() as never)).rejects.toMatchObject({ statusCode: 403 });
    expect(serviceInstance.verifyPunchItem).not.toHaveBeenCalled();
    expect(serviceInstance.reopenPunchItem).not.toHaveBeenCalled();
    expect(serviceInstance.markCloseoutReady).not.toHaveBeenCalled();
    expect(serviceInstance.markCloseoutHandedOff).not.toHaveBeenCalled();
  });

  it("allows the assigned technician to resolve and passes the actor through", async () => {
    const res = response();
    serviceInstance.resolvePunchItem.mockResolvedValue({ id: "punch-1", status: "resolved" });

    await closeoutController.resolvePunchItem(requestFor("technician"), res as never);

    expect(serviceInstance.resolvePunchItem).toHaveBeenCalledWith("punch-1", "org-1", "user-1", "technician");
    expect(res.json).toHaveBeenCalledWith({ id: "punch-1", status: "resolved" });
  });

  it("denies viewer resolve (viewer is not a manager and never an assignee path)", async () => {
    await expect(closeoutController.resolvePunchItem(requestFor("viewer"), response() as never)).rejects.toMatchObject({ statusCode: 403 });
    expect(serviceInstance.resolvePunchItem).not.toHaveBeenCalled();
  });

  it("passes the authenticated user id and org through on create, ready, and handoff", async () => {
    const createRes = response();
    const readyRes = response();
    const handoffRes = response();
    serviceInstance.createCloseoutForProject.mockResolvedValue({ id: "closeout-1", status: "draft" });
    serviceInstance.markCloseoutReady.mockResolvedValue({ closeout: { id: "closeout-1", status: "ready" }, checklist: { ready: true } });
    serviceInstance.markCloseoutHandedOff.mockResolvedValue({ id: "closeout-1", status: "handed_off" });

    await closeoutController.createCloseout(requestFor("owner", { body: { notes: "Done" } }), createRes as never);
    await closeoutController.markReady(requestFor("dispatcher"), readyRes as never);
    await closeoutController.markHandedOff(requestFor("admin"), handoffRes as never);

    expect(serviceInstance.createCloseoutForProject).toHaveBeenCalledWith({
      orgId: "org-1",
      projectId: "project-1",
      notes: "Done",
      actorUserId: "user-1",
    });
    expect(serviceInstance.markCloseoutReady).toHaveBeenCalledWith("project-1", "org-1", "user-1", "dispatcher");
    expect(serviceInstance.markCloseoutHandedOff).toHaveBeenCalledWith("project-1", "org-1", "user-1", "admin");
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(readyRes.json).toHaveBeenCalledWith({ closeout: { id: "closeout-1", status: "ready" }, checklist: { ready: true } });
    expect(handoffRes.json).toHaveBeenCalledWith({ id: "closeout-1", status: "handed_off" });
  });

  it("passes punch and warranty creates through with the creator id", async () => {
    const punchRes = response();
    const warrantyRes = response();
    serviceInstance.createPunchItem.mockResolvedValue({ id: "punch-1", status: "open" });
    serviceInstance.createWarrantyRecord.mockResolvedValue({ id: "warranty-1", sourceType: "contract" });

    await closeoutController.createPunchItem(
      requestFor("owner", { body: { title: "Touch up", priority: "high" } }),
      punchRes as never,
    );
    await closeoutController.createWarranty(
      requestFor("owner", { body: { title: "Workmanship", coverageText: "Two years.", sourceType: "contract", contractId: "11111111-2222-4333-8444-555555555555" } }),
      warrantyRes as never,
    );

    expect(serviceInstance.createPunchItem).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-1", projectId: "project-1", title: "Touch up", priority: "high", createdById: "user-1" }),
    );
    expect(serviceInstance.createWarrantyRecord).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-1", projectId: "project-1", title: "Workmanship", coverageText: "Two years.", sourceType: "contract", createdById: "user-1" }),
    );
    expect(punchRes.status).toHaveBeenCalledWith(201);
    expect(warrantyRes.status).toHaveBeenCalledWith(201);
  });

  it("reads (closeout, punch list, warranties, document) require only crm.read", async () => {
    serviceInstance.getCloseoutByProject.mockResolvedValue({ closeout: { id: "closeout-1" }, checklist: {} });
    serviceInstance.listPunchItemsByProject.mockResolvedValue([]);
    serviceInstance.listWarrantyRecordsByProject.mockResolvedValue([]);
    serviceInstance.getCloseoutDocumentHtml.mockResolvedValue({ html: "<!doctype html>", filename: "closeout-x.html" });

    const res = response();
    await closeoutController.getCloseout(requestFor("technician"), res as never);
    await closeoutController.listPunchItems(requestFor("technician"), res as never);
    await closeoutController.listWarranties(requestFor("viewer"), res as never);
    await closeoutController.getDocument(requestFor("technician"), res as never);

    expect(serviceInstance.getCloseoutByProject).toHaveBeenCalledWith("project-1", "org-1");
    expect(serviceInstance.listPunchItemsByProject).toHaveBeenCalledWith("project-1", "org-1");
    expect(serviceInstance.listWarrantyRecordsByProject).toHaveBeenCalledWith("project-1", "org-1");
    expect(serviceInstance.getCloseoutDocumentHtml).toHaveBeenCalledWith("project-1", "org-1");
  });

  it("serves the closeout document as inline HTML, not JSON", async () => {
    serviceInstance.getCloseoutDocumentHtml.mockResolvedValue({ html: "<!doctype html><html></html>", filename: "closeout-x.html" });
    const res = response();

    await closeoutController.getDocument(requestFor("technician"), res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/html; charset=utf-8");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", 'inline; filename="closeout-x.html"');
    expect(res.send).toHaveBeenCalledWith("<!doctype html><html></html>");
    expect(res.json).not.toHaveBeenCalled();
  });
});
