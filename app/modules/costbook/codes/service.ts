import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db/client";
import {
  CODE_REFERENCES_DISCLAIMER,
  type CodeReference,
  type CodeReferenceQuery,
  type CodeTopic,
} from "./registry";

export type CodesSourceWithScope = Prisma.CodesSourceGetPayload<{
  include: { authority: true; jurisdiction: true };
}>;

/** Minimal client surface the service needs; defaults to the request-scoped `prisma` proxy. */
export interface CodesRegistryClient {
  codesSource: {
    findMany: (args: Prisma.CodesSourceFindManyArgs) => Promise<CodesSourceWithScope[]>;
  };
}

const CODE_TOPICS: readonly CodeTopic[] = ["signage", "permits", "electrical", "structural", "right-of-way"];

function isCodeTopic(value: string): value is CodeTopic {
  return (CODE_TOPICS as readonly string[]).includes(value);
}

function normalizeCounty(county: string | undefined): string {
  return (county ?? "").trim().toLowerCase().replace(/ county$/, "");
}

function formatDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * Pure Prisma `where` for a code-reference search. Mirrors the pilot
 * registry's filter semantics exactly:
 * - state must match (normalized to uppercase);
 * - without an explicit county only statewide (county NULL) sources match;
 * - with a county, statewide sources plus that county's sources match —
 *   an unindexed county never inherits another county's ordinances;
 * - only `reviewed` sources are served: `research` rows await explicit
 *   human publication approval and `superseded` rows are replaced.
 */
export function buildCodeSourcesWhere(query: CodeReferenceQuery): Prisma.CodesSourceWhereInput {
  const state = query.state.trim().toUpperCase();
  const county = normalizeCounty(query.county);
  const term = (query.q ?? "").trim();
  const where: Prisma.CodesSourceWhereInput = {
    status: "reviewed",
    jurisdiction: {
      state,
      ...(county
        ? { OR: [{ county: null }, { county: { equals: county, mode: "insensitive" } }] }
        : { county: null }),
    },
  };
  if (query.topic) {
    where.topics = { has: query.topic };
  }
  if (term) {
    const contains = { contains: term, mode: "insensitive" as const };
    where.OR = [
      { title: contains },
      { citation: contains },
      { summary: contains },
      { nextAction: contains },
      { authority: { name: contains } },
    ];
  }
  return where;
}

/** Maps one joined DB row to the pilot API item. Field names, order of keys and values match the registry. */
export function mapCodeSourceToReference(row: CodesSourceWithScope): CodeReference {
  // The query's jurisdiction filter only matches rows with a jurisdiction;
  // a row reaching here without one is corrupt data — fail closed.
  const jurisdiction = row.jurisdiction;
  if (!jurisdiction) {
    throw new Error(`codes_source ${row.id} has no jurisdiction`);
  }
  return {
    id: row.id,
    title: row.title,
    issuer: row.authority.name,
    citation: row.citation,
    state: jurisdiction.state,
    county: jurisdiction.county,
    sourceUrl: row.sourceUrl,
    sourceDate: formatDate(row.publishedDate),
    reviewedAt: formatDate(row.reviewedAt) ?? "",
    topics: row.topics.filter(isCodeTopic),
    summary: row.summary ?? "",
    nextAction: row.nextAction ?? "",
    applicability: "unverified",
  };
}

/**
 * DB-backed replacement for the pilot's in-code `listCodeReferences`.
 * Reads codes_source (joined to authority + jurisdiction) inside the
 * caller's request-scoped database session, so forced RLS applies.
 * Response envelope is identical to the pilot: `{status:"advisory",
 * disclaimer, items, total}`. Rows are ordered by source id; the seed
 * UUIDs are assigned in pilot-registry order, so the seeded response
 * order is unchanged.
 */
export async function listCodeReferencesFromDb(
  query: CodeReferenceQuery,
  client: CodesRegistryClient = prisma as unknown as CodesRegistryClient,
): Promise<{ status: "advisory"; disclaimer: string; items: CodeReference[]; total: number }> {
  const rows = await client.codesSource.findMany({
    where: buildCodeSourcesWhere(query),
    include: { authority: true, jurisdiction: true },
    orderBy: { id: "asc" },
  });
  const items = rows.map(mapCodeSourceToReference);
  return { status: "advisory", disclaimer: CODE_REFERENCES_DISCLAIMER, items, total: items.length };
}
