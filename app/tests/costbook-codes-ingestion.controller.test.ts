import { costbookCodesIngestionController } from "../backend/controllers/costbookCodesIngestion.controller";
import {
  approveCodeSource,
  getCodeSource,
  ingestOfficialCodeSource,
  listCodeSourceReviewQueue,
  listCodeSources,
  rejectCodeSource,
} from "../modules/costbook/codes/ingestion";

jest.mock("../modules/costbook/codes/ingestion", () => ({
  ingestOfficialCodeSource: jest.fn(),
  listCodeSources: jest.fn(),
  listCodeSourceReviewQueue: jest.fn(),
  getCodeSource: jest.fn(),
  approveCodeSource: jest.fn(),
  rejectCodeSource: jest.fn(),
}));

const mockedIngest = ingestOfficialCodeSource as jest.Mock;
const mockedList = listCodeSources as jest.Mock;
const mockedQueue = listCodeSourceReviewQueue as jest.Mock;
const mockedGet = getCodeSource as jest.Mock;
const mockedApprove = approveCodeSource as jest.Mock;
const mockedReject = rejectCodeSource as jest.Mock;

const response = () => ({
  json: jest.fn(),
  setHeader: jest.fn(),
});

const request = (overrides: Record<string, unknown> = {}, role = "admin") => ({
  auth: { userId: "staff-1", orgId: "org-1", role },
  orgId: "org-1",
  ...overrides,
});

const ingestBody = {
  jurisdictionId: "10000000-0000-0000-0000-000000000001",
  authorityId: "10000000-0000-0000-0000-000000000002",
  codeFamily: "sign-permits",
  citation: "INDOT — Outdoor Advertising Sign Permits",
  title: "INDOT outdoor advertising sign permits",
  sourceUrl: "https://www.in.gov/indot/doing-business-with-indot/permits/",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Codes & Permits ingestion endpoints", () => {
  it("ingests for owner/admin and passes the strict body through", async () => {
    mockedIngest.mockResolvedValue({ outcome: "created", source: { id: "source-1" } });
    const res = response();
    await costbookCodesIngestionController.ingest(request({ body: ingestBody }) as never, res as never);
    expect(mockedIngest).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "staff-1", orgId: "org-1" }),
      expect.objectContaining({ sourceUrl: ingestBody.sourceUrl }),
    );
    expect(res.json).toHaveBeenCalledWith({ outcome: "created", source: { id: "source-1" } });
  });

  it("denies ingest for non-admin roles and unauthenticated callers", async () => {
    const res = response();
    await expect(
      costbookCodesIngestionController.ingest(request({ body: ingestBody }, "technician") as never, res as never),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      costbookCodesIngestionController.ingest({ body: ingestBody } as never, res as never),
    ).rejects.toThrow("Organization context is required");
    expect(mockedIngest).not.toHaveBeenCalled();
  });

  it("rejects unknown body keys and malformed dates before the service runs (allowlist refusal is the service's job, covered in the service tests)", async () => {
    await expect(
      costbookCodesIngestionController.ingest(
        request({ body: { ...ingestBody, status: "reviewed" } }) as never,
        response() as never,
      ),
    ).rejects.toThrow();
    await expect(
      costbookCodesIngestionController.ingest(
        request({ body: { ...ingestBody, effectiveDate: "tomorrow" } }) as never,
        response() as never,
      ),
    ).rejects.toThrow();
    expect(mockedIngest).not.toHaveBeenCalled();
  });

  it("lists sources and the review queue for costbook.read roles with no-store caching", async () => {
    mockedList.mockResolvedValue({ status: "advisory", total: 0, items: [] });
    mockedQueue.mockResolvedValue({ status: "advisory", total: 0, items: [] });
    const listRes = response();
    await costbookCodesIngestionController.list(request({ query: { status: "research" } }, "technician") as never, listRes as never);
    expect(listRes.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(mockedList).toHaveBeenCalledWith(expect.objectContaining({ role: "technician" }), { status: "research", limit: undefined });

    const queueRes = response();
    await costbookCodesIngestionController.reviewQueue(request({ query: {} }, "technician") as never, queueRes as never);
    expect(queueRes.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(mockedQueue).toHaveBeenCalled();

    await expect(
      costbookCodesIngestionController.list(request({ query: { status: "published" } }, "technician") as never, response() as never),
    ).rejects.toThrow();
    await expect(
      costbookCodesIngestionController.list(request({ query: { limit: "500" } }, "technician") as never, response() as never),
    ).rejects.toThrow();
    await expect(
      costbookCodesIngestionController.list(request({ query: {} }, "viewer") as never, response() as never),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("reads one source by id and validates the id", async () => {
    mockedGet.mockResolvedValue({ id: "10000000-0000-0000-0000-000000000001" });
    const res = response();
    await costbookCodesIngestionController.getById(
      request({ params: { id: "10000000-0000-0000-0000-000000000001" } }, "technician") as never,
      res as never,
    );
    expect(mockedGet).toHaveBeenCalledWith(
      expect.objectContaining({ role: "technician" }),
      "10000000-0000-0000-0000-000000000001",
    );
    await expect(
      costbookCodesIngestionController.getById(request({ params: { id: "not-a-uuid" } }, "technician") as never, response() as never),
    ).rejects.toThrow();
  });

  it("approves and rejects only for owner/admin, with a reason required to reject", async () => {
    mockedApprove.mockResolvedValue({ id: "source-1", status: "reviewed" });
    mockedReject.mockResolvedValue({ id: "source-1", status: "superseded" });
    const approveRes = response();
    await costbookCodesIngestionController.approve(
      request({ params: { id: "10000000-0000-0000-0000-000000000001" }, body: {} }) as never,
      approveRes as never,
    );
    expect(mockedApprove).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin" }),
      "10000000-0000-0000-0000-000000000001",
      { reviewNotes: undefined },
    );

    const rejectRes = response();
    await costbookCodesIngestionController.reject(
      request({ params: { id: "10000000-0000-0000-0000-000000000001" }, body: { reason: "Wrong edition linked" } }) as never,
      rejectRes as never,
    );
    expect(mockedReject).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin" }),
      "10000000-0000-0000-0000-000000000001",
      { reason: "Wrong edition linked", reviewNotes: undefined },
    );

    await expect(
      costbookCodesIngestionController.approve(
        request({ params: { id: "10000000-0000-0000-0000-000000000001" }, body: {} }, "dispatcher") as never,
        response() as never,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      costbookCodesIngestionController.reject(
        request({ params: { id: "10000000-0000-0000-0000-000000000001" }, body: {} }) as never,
        response() as never,
      ),
    ).rejects.toThrow();
    await expect(
      costbookCodesIngestionController.reject(
        request({ params: { id: "10000000-0000-0000-0000-000000000001" }, body: { reason: "x" } }, "technician") as never,
        response() as never,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
