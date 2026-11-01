const mockPrisma = { settingsAssetUpload: { findUnique: jest.fn() } };
jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { loadOrganizationPdfLogo } from "../modules/documents/pdf-logo-storage";

const orgId = "11111111-1111-4111-8111-111111111111";
const otherOrg = "22222222-2222-4222-8222-222222222222";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPYX2ONFTEMLQkAqeRdgcrsUtEAAAAASUVORK5CYII=", "base64");
const path = `organizations/${orgId}/brand-assets/logoUrl-33333333-3333-4333-8333-333333333333`;
const originalEnv = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
const originalFetch = globalThis.fetch;
const row = { orgId, assetKey: "logoUrl", storageBucket: "project-files", storagePath: path, contentType: "image/png", sizeBytes: png.length };

describe("authenticated organization PDF logo retrieval", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-secret";
    mockPrisma.settingsAssetUpload.findUnique.mockResolvedValue(row);
    fetchMock.mockResolvedValue(new Response(png, { status: 200, headers: { "Content-Type": "image/png" } }));
    globalThis.fetch = fetchMock as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalEnv.url;
    if (originalEnv.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.key;
  });
  it("downloads only active same-organization logo metadata from the private bucket", async () => {
    await expect(loadOrganizationPdfLogo(orgId)).resolves.toEqual(png);
    expect(mockPrisma.settingsAssetUpload.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId_assetKey: { orgId, assetKey: "logoUrl" } } }));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://example.supabase.co/storage/v1/object/authenticated/project-files/${path}`);
    expect(options.redirect).toBe("error");
    expect(options.headers).toEqual(expect.objectContaining({ Authorization: "Bearer test-server-secret" }));
  });
  it("refuses missing org identity, mismatched org, or other-organization object paths without network access", async () => {
    expect(await loadOrganizationPdfLogo(undefined)).toBeNull();
    mockPrisma.settingsAssetUpload.findUnique.mockResolvedValueOnce({ ...row, orgId: otherOrg });
    expect(await loadOrganizationPdfLogo(orgId)).toBeNull();
    mockPrisma.settingsAssetUpload.findUnique.mockResolvedValueOnce({ ...row, storagePath: `organizations/${otherOrg}/brand-assets/logoUrl-33333333-3333-4333-8333-333333333333` });
    expect(await loadOrganizationPdfLogo(orgId)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns a safe fallback when credentials, metadata or image type is not supported", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(await loadOrganizationPdfLogo(orgId)).toBeNull();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-secret";
    mockPrisma.settingsAssetUpload.findUnique.mockResolvedValueOnce({ ...row, contentType: "image/svg+xml" });
    expect(await loadOrganizationPdfLogo(orgId)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects unsupported response MIME, corrupt images, and excessive response bodies", async () => {
    fetchMock.mockResolvedValueOnce(new Response(png, { headers: { "Content-Type": "text/html" } }));
    expect(await loadOrganizationPdfLogo(orgId)).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(Buffer.from("not a PNG"), { headers: { "Content-Type": "image/png" } }));
    expect(await loadOrganizationPdfLogo(orgId)).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(Buffer.alloc(1024 * 1024 + 1), { headers: { "Content-Type": "image/png" } }));
    expect(await loadOrganizationPdfLogo(orgId)).toBeNull();
  });
  it("returns fallback instead of following storage redirects or throwing on failed download", async () => {
    fetchMock.mockRejectedValueOnce(new Error("redirect blocked"));
    expect(await loadOrganizationPdfLogo(orgId)).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(null, {status:404}));
    expect(await loadOrganizationPdfLogo(orgId)).toBeNull();
  });
});
