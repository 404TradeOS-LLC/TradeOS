const list = jest.fn();
const get = jest.fn();
const create = jest.fn();
const update = jest.fn();
const submit = jest.fn();
const remove = jest.fn();

jest.mock("../modules/costbook/codes/permitTasks.service", () => ({
  CodesPermitTasksService: jest.fn().mockImplementation(() => ({ list, get, create, update, submit, remove })),
}));

import { codesPermitTasksController } from "../backend/controllers/costbookCodesPermitTasks.controller";

const ORG = "org-1";
const PROJECT = "10000000-0000-0000-0000-000000000081";
const TASK = "20000000-0000-0000-0000-000000000002";

function responseDouble() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

function baseReq(overrides: Record<string, unknown> = {}) {
  return {
    params: { taskId: TASK },
    query: { projectId: PROJECT },
    orgId: ORG,
    auth: { userId: "user-1", orgId: ORG, role: "owner" },
    ...overrides,
  } as any;
}

describe("codesPermitTasksController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists tasks for the requested project", async () => {
    list.mockResolvedValue([]);
    const res = responseDouble();
    await codesPermitTasksController.list(baseReq(), res);
    expect(list).toHaveBeenCalledWith(ORG, "owner", "user-1", PROJECT);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("rejects listing without a projectId", async () => {
    await expect(codesPermitTasksController.list(baseReq({ query: {} }), responseDouble())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("creates a task with the explicit kind and title", async () => {
    create.mockResolvedValue({ id: TASK });
    const res = responseDouble();
    await codesPermitTasksController.create(
      baseReq({ body: { projectId: PROJECT, taskKind: "permit", title: "File county sign permit" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: ORG, role: "owner", taskKind: "permit", title: "File county sign permit" }),
    );
  });

  it("rejects unknown task kinds and statuses at the controller boundary", async () => {
    await expect(
      codesPermitTasksController.create(baseReq({ body: { projectId: PROJECT, taskKind: "other", title: "x" } }), responseDouble()),
    ).rejects.toThrow();
    await expect(
      codesPermitTasksController.update(
        baseReq({ body: { expectedUpdatedAt: "2026-11-09T12:00:00.000Z", permitStatus: "probably_fine" } }),
        responseDouble(),
      ),
    ).rejects.toThrow();
  });

  it("passes the explicit confirm flag through on submit", async () => {
    submit.mockResolvedValue({ id: TASK, permitStatus: "submitted" });
    const res = responseDouble();
    await codesPermitTasksController.submit(
      baseReq({ body: { expectedUpdatedAt: "2026-11-09T12:00:00.000Z", confirm: true } }),
      res,
    );
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: TASK, confirm: true, expectedUpdatedAt: new Date("2026-11-09T12:00:00.000Z") }),
    );
    expect(res.json).toHaveBeenCalledWith({ id: TASK, permitStatus: "submitted" });
  });
});
