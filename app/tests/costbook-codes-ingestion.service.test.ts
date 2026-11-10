import type { AuthContext } from "../backend/auth/context";
import {
  approveCodeSource,
  getCodeSource,
  ingestOfficialCodeSource,
  listCodeSourceReviewQueue,
  listCodeSources,
  rejectCodeSource,
  type IngestCodeSourceInput,
} from "../modules/costbook/codes/ingestion";
import { computeSourceHash } from "../modules/costbook/codes/sourceAllowlist";
import type {
  CodesSourceStore,
  IngestVersionInput,
  InsertVersionResult,
  ReviewTransitionInput,
  SourceIdentity,
} from "../modules/costbook/codes/store";
import type { CodeSourceRow, CodeSourceStatus } from "../modules/costbook/codes/types";

const textEncoder = new TextEncoder();
const JURISDICTION_ID = "10000000-0000-0000-0000-000000000001";
const AUTHORITY_ID = "10000000-0000-0000-0000-000000000002";
const SOURCE_URL = "https://www.in.gov/indot/doing-business-with-indot/permits/";

const ownerAuth: AuthContext = { userId: "10000000-0000-0000-0000-000000000011", orgId: "10000000-0000-0000-0000-000000000001", role: "owner" };
const adminAuth: AuthContext = { userId: "10000000-0000-0000-0000-000000000012", orgId: "10000000-0000-0000-0000-000000000001", role: "admin" };
const dispatcherAuth: AuthContext = { userId: "10000000-0000-0000-0000-000000000013", orgId: "10000000-0000-0000-0000-000000000001", role: "dispatcher" };
const technicianAuth: AuthContext = { userId: "10000000-0000-0000-0000-000000000014", orgId: "10000000-0000-0000-0000-000000000001", role: "technician" };
const viewerAuth: AuthContext = { userId: "10000000-0000-0000-0000-000000000015", orgId: "10000000-0000-0000-0000-000000000001", role: "viewer" };

/**
 * In-memory stand-in for `PrismaCodesSourceStore`, implementing the same
 * store contract (hash-compare under lock, supersede-don't-mutate,
 * research-only transitions, history entries, audit events) so the
 * service rules are testable without Postgres.
 */
class FakeCodesSourceStore implements CodesSourceStore {
  rows = new Map<string, CodeSourceRow>();
  history: Array<{ codesSourceId: string; versionLabel: string | null; sourceHash: string | null; status: CodeSourceStatus }> = [];
  audit: Array<{ eventType: string; actorUserId: string; metadata: Record<string, unknown> }> = [];
  private sequence = 0;

  private hasNewerVersion(id: string): boolean {
    return [...this.rows.values()].some((row) => row.supersedesId === id);
  }

  private withNewer(row: CodeSourceRow): CodeSourceRow & { hasNewerVersion: boolean } {
    return { ...row, hasNewerVersion: this.hasNewerVersion(row.id) };
  }

  /** Test-only backdoor: seed a row exactly as given (simulates another path's data). */
  seedRow(row: CodeSourceRow): void {
    this.rows.set(row.id, { ...row });
  }

  async findLatestByCitation(identity: SourceIdentity) {
    const latest = [...this.rows.values()]
      .filter(
        (row) =>
          row.authorityId === identity.authorityId &&
          row.codeFamily === identity.codeFamily &&
          row.citation === identity.citation &&
          !this.hasNewerVersion(row.id),
      )
      .sort((a, b) => Number(a.versionLabel?.slice(1) ?? 0) - Number(b.versionLabel?.slice(1) ?? 0))
      .at(-1);
    return latest ? this.withNewer(latest) : null;
  }

  async list(filter: { status?: CodeSourceStatus; limit?: number }) {
    const rows = [...this.rows.values()]
      .filter((row) => !filter.status || row.status === filter.status)
      .sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl) || Number(a.versionLabel?.slice(1) ?? 0) - Number(b.versionLabel?.slice(1) ?? 0))
      .slice(0, filter.limit ?? 25);
    return rows.map((row) => this.withNewer(row));
  }

  async getById(id: string) {
    const row = this.rows.get(id);
    return row ? this.withNewer(row) : null;
  }

  async insertVersionIfChanged(input: IngestVersionInput, actor: { userId: string; orgId: string }): Promise<InsertVersionResult> {
    const latest = await this.findLatestByCitation(input);
    if (latest && latest.sourceHash === input.sourceHash) {
      return { row: latest, created: false };
    }
    const versionLabel = `v${[...this.rows.values()].filter((row) => row.authorityId === input.authorityId && row.codeFamily === input.codeFamily && row.citation === input.citation).length + 1}`;
    this.sequence += 1;
    const row: CodeSourceRow = {
      id: `00000000-0000-0000-0000-${String(this.sequence).padStart(12, "0")}`,
      jurisdictionId: input.jurisdictionId,
      authorityId: input.authorityId,
      codeFamily: input.codeFamily,
      section: input.section,
      citation: input.citation,
      title: input.title,
      sourceUrl: input.sourceUrl,
      sourceHash: input.sourceHash,
      licenseNote: input.licenseNote,
      publishedDate: input.publishedDate,
      amendedDate: input.amendedDate,
      effectiveDate: input.effectiveDate,
      expiryDate: input.expiryDate,
      status: "research",
      reviewedAt: null,
      reviewedBy: null,
      versionLabel,
      supersedesId: latest?.id ?? null,
    };
    this.rows.set(row.id, row);
    this.history.push({ codesSourceId: row.id, versionLabel, sourceHash: row.sourceHash, status: "research" });
    if (latest) {
      const old = this.rows.get(latest.id);
      if (old && old.status !== "superseded") {
        old.status = "superseded";
        this.history.push({ codesSourceId: old.id, versionLabel: old.versionLabel, sourceHash: old.sourceHash, status: "superseded" });
      }
    }
    this.audit.push({
      eventType: "costbook.codes_source.ingested",
      actorUserId: actor.userId,
      metadata: { sourceUrl: row.sourceUrl, sourceHash: row.sourceHash, versionLabel },
    });
    return { row, created: true };
  }

  async transition(input: ReviewTransitionInput): Promise<CodeSourceRow> {
    const row = this.rows.get(input.id);
    if (!row) {
      const error = new Error(`Codes source ${input.id} not found`) as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }
    if (row.status !== "research") {
      const error = new Error(`Codes source ${input.id} has already been reviewed (${row.status})`) as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }
    row.status = input.toStatus;
    row.reviewedAt = new Date().toISOString();
    row.reviewedBy = input.actorUserId;
    this.history.push({ codesSourceId: row.id, versionLabel: row.versionLabel, sourceHash: row.sourceHash, status: row.status });
    this.audit.push({
      eventType: `costbook.codes_source.${input.decision}`,
      actorUserId: input.actorUserId,
      metadata: { decision: input.decision, reason: input.reason ?? null, reviewNotes: input.reviewNotes ?? null },
    });
    return { ...row };
  }
}

function ingestInput(overrides: Partial<IngestCodeSourceInput> = {}): IngestCodeSourceInput {
  return {
    jurisdictionId: JURISDICTION_ID,
    authorityId: AUTHORITY_ID,
    codeFamily: "sign-permits",
    citation: "INDOT — Outdoor Advertising Sign Permits",
    title: "INDOT outdoor advertising sign permits",
    sourceUrl: SOURCE_URL,
    ...overrides,
  };
}

function fetchFor(body: string): typeof fetch {
  return (async () => new Response(textEncoder.encode(body), { status: 200 })) as typeof fetch;
}

describe("governed codes source ingestion service", () => {
  it("creates a research version with the fetched hash and no guessed dates", async () => {
    const store = new FakeCodesSourceStore();
    const body = "indot permits page v1";
    const result = await ingestOfficialCodeSource(ownerAuth, ingestInput(), { store, fetchImpl: fetchFor(body) });
    expect(result.outcome).toBe("created");
    expect(result.source.status).toBe("research");
    expect(result.source.versionLabel).toBe("v1");
    expect(result.source.sourceHash).toBe(computeSourceHash(textEncoder.encode(body)));
    expect(result.source.publishedDate).toBeNull();
    expect(result.source.amendedDate).toBeNull();
    expect(result.source.effectiveDate).toBeNull();
    expect(result.source.expiryDate).toBeNull();
    expect(result.source.reviewedAt).toBeNull();
    expect(result.source.reviewedBy).toBeNull();
    expect(result.fetchedBytes).toBe(textEncoder.encode(body).byteLength);
    // No full code text is ever persisted: the stored row carries only
    // citation + URL + hash + metadata.
    const stored = [...store.rows.values()][0];
    expect(JSON.stringify(stored)).not.toContain(body);
    expect(Object.keys(stored).sort()).toEqual(
      ["id", "jurisdictionId", "authorityId", "codeFamily", "section", "citation", "title", "sourceUrl", "sourceHash", "licenseNote", "publishedDate", "amendedDate", "effectiveDate", "expiryDate", "status", "reviewedAt", "reviewedBy", "versionLabel", "supersedesId"].sort(),
    );
  });

  it("stores source-stated dates when the caller supplies them", async () => {
    const store = new FakeCodesSourceStore();
    const result = await ingestOfficialCodeSource(ownerAuth, ingestInput({ publishedDate: "2014-12-01", effectiveDate: "2015-01-01" }), {
      store,
      fetchImpl: fetchFor("dated"),
    });
    expect(result.source.publishedDate).toBe("2014-12-01");
    expect(result.source.effectiveDate).toBe("2015-01-01");
    expect(result.source.amendedDate).toBeNull();
  });

  it("is idempotent: the same bytes twice create one row and write nothing the second time", async () => {
    const store = new FakeCodesSourceStore();
    const first = await ingestOfficialCodeSource(ownerAuth, ingestInput(), { store, fetchImpl: fetchFor("same bytes") });
    const second = await ingestOfficialCodeSource(ownerAuth, ingestInput(), { store, fetchImpl: fetchFor("same bytes") });
    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("unchanged");
    expect(second.source.id).toBe(first.source.id);
    expect(store.rows.size).toBe(1);
    expect(store.history).toHaveLength(1);
    expect(store.audit).toHaveLength(1);
  });

  it("refuses untrusted URLs with no fetch attempted", async () => {
    const store = new FakeCodesSourceStore();
    const fetchImpl = jest.fn(fetchFor("x"));
    await expect(
      ingestOfficialCodeSource(ownerAuth, ingestInput({ sourceUrl: "https://evil.com/ordinance.pdf" }), { store, fetchImpl }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      ingestOfficialCodeSource(ownerAuth, ingestInput({ sourceUrl: "http://www.in.gov/indot/" }), { store, fetchImpl }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(store.rows.size).toBe(0);
  });

  it("fails closed when the official source fetch fails", async () => {
    const store = new FakeCodesSourceStore();
    await expect(
      ingestOfficialCodeSource(ownerAuth, ingestInput(), {
        store,
        fetchImpl: (async () => new Response("gone", { status: 404 })) as typeof fetch,
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(store.rows.size).toBe(0);
  });

  it("never auto-publishes: changed content supersedes the reviewed head and stays research", async () => {
    const store = new FakeCodesSourceStore();
    const v1 = await ingestOfficialCodeSource(ownerAuth, ingestInput(), { store, fetchImpl: fetchFor("v1 bytes") });
    const approved = await approveCodeSource(adminAuth, v1.source.id, {}, { store });
    expect(approved.status).toBe("reviewed");
    expect(approved.reviewedBy).toBe(adminAuth.userId);
    expect(approved.reviewedAt).not.toBeNull();

    const v2 = await ingestOfficialCodeSource(ownerAuth, ingestInput(), { store, fetchImpl: fetchFor("v2 bytes changed") });
    expect(v2.outcome).toBe("created");
    expect(v2.source.status).toBe("research");
    expect(v2.source.versionLabel).toBe("v2");
    expect(v2.source.supersedesId).toBe(v1.source.id);

    const old = await getCodeSource(ownerAuth, v1.source.id, { store });
    expect(old.status).toBe("superseded");
    expect(old.warnings).toContain("superseded");
    expect(old.sourceHash).toBe(computeSourceHash(textEncoder.encode("v1 bytes")));
    // History: v1 creation, v1 approval, v2 creation, v1 supersede.
    expect(store.history).toHaveLength(4);
    expect(store.history.map((entry) => `${entry.versionLabel}:${entry.status}`)).toEqual([
      "v1:research",
      "v1:reviewed",
      "v2:research",
      "v1:superseded",
    ]);
  });

  it("surfaces expired warnings for reviewed sources past expiry and none before", async () => {
    const store = new FakeCodesSourceStore();
    const fresh = await ingestOfficialCodeSource(ownerAuth, ingestInput({ expiryDate: "2999-01-01" }), { store, fetchImpl: fetchFor("a") });
    await approveCodeSource(ownerAuth, fresh.source.id, {}, { store });
    expect((await getCodeSource(ownerAuth, fresh.source.id, { store })).warnings).toEqual([]);

    const stale = await ingestOfficialCodeSource(ownerAuth, ingestInput({ citation: "INDOT — Above Ground Occupancy", sourceUrl: "https://www.in.gov/indot/doing-business-with-indot/permits/", expiryDate: "2020-01-01" }), {
      store,
      fetchImpl: fetchFor("b"),
    });
    await approveCodeSource(ownerAuth, stale.source.id, {}, { store });
    expect((await getCodeSource(ownerAuth, stale.source.id, { store })).warnings).toContain("expired");
  });

  it("refuses ingest/approve/reject for non-admin roles and reads for viewers", async () => {
    const store = new FakeCodesSourceStore();
    await expect(
      ingestOfficialCodeSource(dispatcherAuth, ingestInput(), { store, fetchImpl: fetchFor("x") }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      ingestOfficialCodeSource(technicianAuth, ingestInput(), { store, fetchImpl: fetchFor("x") }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(store.rows.size).toBe(0);

    const created = await ingestOfficialCodeSource(ownerAuth, ingestInput(), { store, fetchImpl: fetchFor("x") });
    await expect(approveCodeSource(dispatcherAuth, created.source.id, {}, { store })).rejects.toMatchObject({ statusCode: 403 });
    await expect(rejectCodeSource(technicianAuth, created.source.id, { reason: "no" }, { store })).rejects.toMatchObject({ statusCode: 403 });

    // Reads are costbook.read: technician may read, viewer may not.
    expect((await listCodeSources(technicianAuth, {}, { store })).total).toBe(1);
    await expect(listCodeSources(viewerAuth, {}, { store })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("approves only once, rejects only with a reason, and audits every decision", async () => {
    const store = new FakeCodesSourceStore();
    const created = await ingestOfficialCodeSource(ownerAuth, ingestInput(), { store, fetchImpl: fetchFor("x") });
    await expect(rejectCodeSource(ownerAuth, created.source.id, { reason: "   " }, { store })).rejects.toMatchObject({ statusCode: 400 });

    const rejected = await rejectCodeSource(adminAuth, created.source.id, { reason: "Wrong edition linked" }, { store });
    expect(rejected.status).toBe("superseded");
    expect(rejected.reviewedBy).toBe(adminAuth.userId);
    await expect(approveCodeSource(ownerAuth, created.source.id, {}, { store })).rejects.toMatchObject({ statusCode: 409 });
    await expect(rejectCodeSource(ownerAuth, created.source.id, { reason: "again" }, { store })).rejects.toMatchObject({ statusCode: 409 });
    await expect(getCodeSource(ownerAuth, "00000000-0000-0000-0000-000000000099", { store })).rejects.toMatchObject({ statusCode: 404 });

    const decisions = store.audit.filter((entry) => entry.eventType.startsWith("costbook.codes_source."));
    expect(decisions.map((entry) => entry.eventType)).toEqual([
      "costbook.codes_source.ingested",
      "costbook.codes_source.rejected",
    ]);
    expect(decisions[1].metadata.reason).toBe("Wrong edition linked");
    expect(decisions[1].actorUserId).toBe(adminAuth.userId);
  });

  it("refuses to approve a non-head research row and lists only research rows in the review queue", async () => {
    const store = new FakeCodesSourceStore();
    const staleHead: CodeSourceRow = {
      id: "00000000-0000-0000-0000-000000000050",
      jurisdictionId: JURISDICTION_ID,
      authorityId: AUTHORITY_ID,
      codeFamily: "sign-permits",
      section: null,
      citation: "stale",
      title: "stale",
      sourceUrl: SOURCE_URL,
      sourceHash: "a".repeat(64),
      licenseNote: null,
      publishedDate: null,
      amendedDate: null,
      effectiveDate: null,
      expiryDate: null,
      status: "research",
      reviewedAt: null,
      reviewedBy: null,
      versionLabel: "v1",
      supersedesId: null,
    };
    const newerHead: CodeSourceRow = { ...staleHead, id: "00000000-0000-0000-0000-000000000051", sourceHash: "b".repeat(64), versionLabel: "v2", supersedesId: staleHead.id };
    store.seedRow(staleHead);
    store.seedRow(newerHead);
    await expect(approveCodeSource(ownerAuth, staleHead.id, {}, { store })).rejects.toMatchObject({ statusCode: 409 });

    const queue = await listCodeSourceReviewQueue(ownerAuth, { store });
    expect(queue.items.map((item) => item.id)).toEqual([newerHead.id]);
  });
});
