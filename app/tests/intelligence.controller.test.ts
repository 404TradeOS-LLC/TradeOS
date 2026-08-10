import { Request, Response } from "express";

const list = jest.fn();

jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({
    list,
  })),
  AttachmentService: jest.fn().mockImplementation(() => ({})),
  FeatureFlagsService: jest.fn().mockImplementation(() => ({})),
  GlobalSearchService: jest.fn().mockImplementation(() => ({})),
  NotificationCenterService: jest.fn().mockImplementation(() => ({})),
  RecentlyViewedService: jest.fn().mockImplementation(() => ({})),
  SavedViewsService: jest.fn().mockImplementation(() => ({})),
  TagsService: jest.fn().mockImplementation(() => ({})),
  UniversalCommentsService: jest.fn().mockImplementation(() => ({})),
}));

import { intelligenceController } from "../backend/controllers/intelligence.controller";

describe("intelligenceController.listActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires an authenticated permission context when listing task activity", async () => {
    const req = {
      orgId: "org-1",
      query: {
        entityType: "task",
      },
    } as unknown as Request;
    const res = { json: jest.fn() } as unknown as Response;

    await expect(intelligenceController.listActivity(req, res)).rejects.toThrow("Organization context is required");
    expect(list).not.toHaveBeenCalled();
  });

  it("allows crm.read users to list task activity", async () => {
    list.mockResolvedValue([{ id: "event-1" }]);

    const req = {
      orgId: "org-1",
      query: {
        entityType: "task",
        limit: "8",
      },
      auth: {
        userId: "user-1",
        orgId: "org-1",
        role: "technician",
      },
    } as unknown as Request;
    const res = { json: jest.fn() } as unknown as Response;

    await intelligenceController.listActivity(req, res);

    expect(list).toHaveBeenCalledWith({
      orgId: "org-1",
      entityType: "task",
      entityId: undefined,
      eventType: undefined,
      limit: 8,
    });
    expect(res.json).toHaveBeenCalledWith([{ id: "event-1" }]);
  });
});
