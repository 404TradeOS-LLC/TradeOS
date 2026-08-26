const mockService = {
  listOrganizationMemberHistory: jest.fn(),
  listOrganizationMemberHistoryPage: jest.fn(),
};

jest.mock("../modules/admin-dashboard/service", () => ({
  AdminDashboardService: jest.fn().mockImplementation(() => mockService),
}));

jest.mock("../backend/auth/jwt", () => ({
  verifyAuthToken: jest.fn(),
}));

jest.mock("../backend/auth/session", () => ({
  resolveAuthContext: jest.fn(),
}));

jest.mock("../db/requestSession", () => ({
  runWithDatabaseSession: jest.fn((_client, _auth, operation) => operation()),
}));

import { adminUiController } from "../backend/controllers/adminUi.controller";
import { verifyAuthToken } from "../backend/auth/jwt";
import { resolveAuthContext } from "../backend/auth/session";

describe("adminUiController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the membership history form", async () => {
    const res = mockResponse();

    await adminUiController.showMembershipHistoryForm({} as never, res as never);

    expect(res.type).toHaveBeenCalledWith("html");
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Membership History"));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Bearer token"));
  });

  it("renders history results after authenticating the submitted token", async () => {
    (verifyAuthToken as jest.Mock).mockReturnValue({
      sub: "auth-sub-1",
      orgId: "org-1",
      role: "owner",
    });
    (resolveAuthContext as jest.Mock).mockResolvedValue({
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
      email: "owner@example.com",
    });
    mockService.listOrganizationMemberHistoryPage.mockResolvedValue({
      items: [{
        id: "audit-1",
        orgId: "org-1",
        membershipId: "membership-1",
        userId: "user-1",
        action: "updated",
        actorUserId: "user-1",
        actorRole: "owner",
        beforeState: null,
        afterState: null,
        createdAt: new Date("2026-06-24T12:00:00.000Z"),
      }],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    const res = mockResponse();
    await adminUiController.submitMembershipHistoryForm(
      {
        body: {
          bearerToken: "token",
          orgId: "org-1",
          membershipId: "membership-1",
        },
      } as never,
      res as never
    );

    expect(verifyAuthToken).toHaveBeenCalledWith("token", expect.any(String));
    expect(resolveAuthContext).toHaveBeenCalled();
    expect(mockService.listOrganizationMemberHistoryPage).toHaveBeenCalledWith(
      "org-1",
      "membership-1",
      expect.objectContaining({
        actionType: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      }),
      1,
      20
    );
    expect(res.type).toHaveBeenCalledWith("html");
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Audit trail"));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("updated"));
  });

  it("shows an inline error when the org does not match the authenticated token", async () => {
    (verifyAuthToken as jest.Mock).mockReturnValue({
      sub: "auth-sub-1",
      orgId: "org-1",
      role: "owner",
    });
    (resolveAuthContext as jest.Mock).mockResolvedValue({
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
    });

    const res = mockResponse();
    await adminUiController.submitMembershipHistoryForm(
      {
        body: {
          bearerToken: "token",
          orgId: "org-2",
          membershipId: "membership-1",
        },
      } as never,
      res as never
    );

    expect(mockService.listOrganizationMemberHistoryPage).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Cross-organization access is not allowed"));
  });

  it("renders active filter chips and a no-results message when a filtered search returns nothing", async () => {
    (verifyAuthToken as jest.Mock).mockReturnValue({
      sub: "auth-sub-1",
      orgId: "org-1",
      role: "admin",
    });
    (resolveAuthContext as jest.Mock).mockResolvedValue({
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
      email: "admin@example.com",
    });
    mockService.listOrganizationMemberHistoryPage.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });

    const res = mockResponse();
    await adminUiController.submitMembershipHistoryForm(
      {
        body: {
          bearerToken: "token",
          orgId: "org-1",
          membershipId: "membership-1",
          actionType: "disabled",
          dateFrom: "2026-06-01",
          dateTo: "2026-06-30",
        },
      } as never,
      res as never
    );

    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Active filters"));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Action <strong>disabled</strong>"));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("From <strong>2026-06-01</strong>"));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("To <strong>2026-06-30</strong>"));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("No audit entries matched this search."));
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining("Try widening the date range or clearing one of the active filters.")
    );
  });

  it("applies quick date presets and resets pagination", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-24T12:00:00.000Z"));
    (verifyAuthToken as jest.Mock).mockReturnValue({ sub: "auth-sub-1", orgId: "org-1", role: "admin" });
    (resolveAuthContext as jest.Mock).mockResolvedValue({ userId: "user-1", orgId: "org-1", role: "admin" });
    mockService.listOrganizationMemberHistoryPage.mockResolvedValue({
      items: [], page: 1, pageSize: 20, total: 0, totalPages: 1,
    });

    const res = mockResponse();
    await adminUiController.submitMembershipHistoryForm({
      body: {
        bearerToken: "token",
        orgId: "org-1",
        membershipId: "membership-1",
        preset: "7d",
        page: "3",
      },
    } as never, res as never);

    expect(mockService.listOrganizationMemberHistoryPage).toHaveBeenCalledWith(
      "org-1",
      "membership-1",
      expect.objectContaining({
        dateFrom: new Date("2026-06-18T00:00:00.000Z"),
        dateTo: new Date("2026-06-24T23:59:59.999Z"),
      }),
      1,
      20
    );
    jest.useRealTimers();
  });

  it("renders pagination and clear-filter controls", async () => {
    (verifyAuthToken as jest.Mock).mockReturnValue({ sub: "auth-sub-1", orgId: "org-1", role: "admin" });
    (resolveAuthContext as jest.Mock).mockResolvedValue({ userId: "user-1", orgId: "org-1", role: "admin" });
    mockService.listOrganizationMemberHistoryPage.mockResolvedValue({
      items: [{
        id: "audit-21", orgId: "org-1", membershipId: "membership-1", userId: "user-1",
        action: "updated", actorUserId: null, actorRole: "admin", beforeState: null, afterState: null,
        createdAt: new Date("2026-06-20T12:00:00.000Z"),
      }],
      page: 2,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });

    const res = mockResponse();
    await adminUiController.submitMembershipHistoryForm({
      body: {
        bearerToken: "token", orgId: "org-1", membershipId: "membership-1", actionType: "updated", page: "2",
      },
    } as never, res as never);

    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain("Last 7 days");
    expect(html).toContain("Last 30 days");
    expect(html).toContain("Clear actionType filter");
    expect(html).toContain("Clear all filters");
    expect(html).toContain("Page <strong>2</strong> of <strong>3</strong>");
    expect(html).toContain('name="page" value="1"');
    expect(html).toContain('name="page" value="3"');
    expect(html).toContain("Showing <strong>21</strong>-<strong>40</strong> of <strong>45</strong>");
    const actionClearForm = html.match(/<form class="chip chip-form"[\s\S]*?Clear actionType filter[\s\S]*?<\/form>/)?.[0];
    expect(actionClearForm).not.toContain('name="actionType"');
    expect(actionClearForm).not.toContain('name="page"');
  });
});

function mockResponse() {
  const res: Record<string, jest.Mock> = {
    type: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };
  return res;
}
