const mockExecuteRaw = jest.fn(async () => 1);
const mockCurrentActor = jest.fn();
const mockRequestDatabase = jest.fn();
const mockSeparateSession = jest.fn(async (
  _client: unknown, _actor: unknown, operation: () => Promise<unknown>,
) => operation());

jest.mock("../db/client", () => ({
  basePrisma: {},
  prisma: { $executeRaw: mockExecuteRaw },
}));
jest.mock("../db/requestSession", () => ({
  getCurrentDatabaseSessionActor: mockCurrentActor,
  getRequestDatabaseClient: mockRequestDatabase,
  runWithDatabaseSession: mockSeparateSession,
}));

import { abcSupplyRefreshTokenStore } from "../modules/supplier-integration/credentialStore";

const orgId = "6d9fbc90-e4db-45b5-b6c7-852def03695a";
const otherOrgId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const supplierId = "bb73490f-a05d-4e2f-abd9-6179a9df31b6";
const refreshToken = "private-token-marker";
const actor = {
  orgId,
  userId: "ce018fa6-2644-44ae-8c19-6899faf0221c",
  role: "owner",
};

describe("ABC OAuth token persistence / independent refresh rotation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentActor.mockReturnValue(actor);
    mockRequestDatabase.mockReturnValue({ $executeRaw: mockExecuteRaw });
  });

  it("persists a new OAuth authorization token inside the existing transaction (pool size 1)", async () => {
    await abcSupplyRefreshTokenStore.persistInCurrentSession(orgId, supplierId, refreshToken);
    expect(mockSeparateSession).not.toHaveBeenCalled();
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockExecuteRaw).toHaveBeenCalledWith(expect.objectContaining({
      values: expect.arrayContaining([orgId, supplierId, refreshToken]),
    }));
  });

  it("refuses callback writes with no ambient transaction", async () => {
    mockRequestDatabase.mockReturnValue(undefined);
    await expect(abcSupplyRefreshTokenStore.persistInCurrentSession(orgId, supplierId, refreshToken))
      .rejects.toThrow("active database transaction");
    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockSeparateSession).not.toHaveBeenCalled();
  });

  it.each([
    ["missing actor", null],
    ["cross-tenant owner", { ...actor, orgId: otherOrgId }],
    ["non-admin actor", { ...actor, role: "viewer" }],
  ])("fails closed for %s", async (_label, unauthorized) => {
    mockCurrentActor.mockReturnValue(unauthorized);
    await expect(abcSupplyRefreshTokenStore.persistInCurrentSession(orgId, supplierId, refreshToken))
      .rejects.toThrow("active owner/admin tenant session");
    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockSeparateSession).not.toHaveBeenCalled();
  });

  it("preserves a separate transaction and commit for provider-driven token rotation", async () => {
    mockRequestDatabase.mockReturnValue(undefined);
    await abcSupplyRefreshTokenStore.persist(orgId, supplierId, refreshToken);
    expect(mockSeparateSession).toHaveBeenCalledWith(
      expect.anything(), actor, expect.any(Function), "supplier_refresh_token_rotation",
    );
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockExecuteRaw).toHaveBeenCalledWith(expect.objectContaining({
      values: expect.arrayContaining([orgId, supplierId, refreshToken]),
    }));
  });

  it("does not open a rotation transaction or write for unauthorized actors", async () => {
    mockCurrentActor.mockReturnValue({ ...actor, role: "viewer" });
    await expect(abcSupplyRefreshTokenStore.persist(orgId, supplierId, refreshToken))
      .rejects.toThrow("active owner/admin tenant session");
    expect(mockSeparateSession).not.toHaveBeenCalled();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});
