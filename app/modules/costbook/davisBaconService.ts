/**
 * Davis-Bacon read service: determinations and prevailing-wage rates from the
 * synced store. Davis-Bacon rates are government-contract floors, not
 * open-market rates — every DTO carries the sam.gov provenance flag.
 */
import { Prisma } from "@prisma/client";
import { getRequestDatabaseClient } from "../../db/requestSession";

export interface DavisBaconDeterminationDTO {
  id: string;
  wdNumber: string;
  revisionNumber: number;
  state: string;
  stateName: string | null;
  counties: string[];
  constructionTypes: string[];
  modifiedDate: string | null;
  isActive: boolean;
  source: string;
  fetchedAt: string;
}

export interface DavisBaconRateDTO {
  id: string;
  wdNumber: string;
  revisionNumber: number;
  rateIdentifier: string;
  identifierDate: string | null;
  occupation: string;
  baseRate: number;
  rateUnit: string;
  /** Burdened floor = baseRate + fringe (when fringe is present). */
  fringe: number | null;
  fringeExpression: string | null;
  source: string;
}

function db() {
  const client = getRequestDatabaseClient();
  if (!client) throw new Error("Davis-Bacon service requires an active database session");
  return client;
}

function asStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toDeterminationDTO(row: {
  id: string;
  wdNumber: string;
  revisionNumber: number;
  state: string;
  stateName: string | null;
  counties: Prisma.JsonValue;
  constructionTypes: Prisma.JsonValue;
  modifiedDate: string | null;
  isActive: boolean;
  source: string;
  fetchedAt: Date;
}): DavisBaconDeterminationDTO {
  return {
    id: row.id,
    wdNumber: row.wdNumber,
    revisionNumber: row.revisionNumber,
    state: row.state,
    stateName: row.stateName,
    counties: asStringArray(row.counties),
    constructionTypes: asStringArray(row.constructionTypes),
    modifiedDate: row.modifiedDate,
    isActive: row.isActive,
    source: row.source,
    fetchedAt: row.fetchedAt.toISOString(),
  };
}

function toRateDTO(row: {
  id: string;
  wdNumber: string;
  revisionNumber: number;
  rateIdentifier: string;
  identifierDate: string | null;
  occupation: string;
  baseRate: Prisma.Decimal;
  rateUnit: string;
  fringe: Prisma.Decimal | null;
  fringeExpression: string | null;
}): DavisBaconRateDTO {
  return {
    id: row.id,
    wdNumber: row.wdNumber,
    revisionNumber: row.revisionNumber,
    rateIdentifier: row.rateIdentifier,
    identifierDate: row.identifierDate,
    occupation: row.occupation,
    baseRate: row.baseRate.toNumber(),
    rateUnit: row.rateUnit,
    fringe: row.fringe?.toNumber() ?? null,
    fringeExpression: row.fringeExpression,
    source: "sam.gov",
  };
}

export async function listDeterminations(
  orgId: string,
  filters: { state?: string; county?: string; activeOnly?: boolean },
): Promise<DavisBaconDeterminationDTO[]> {
  const rows = await db().davisBaconDetermination.findMany({
    where: {
      orgId,
      ...(filters.state ? { state: filters.state } : {}),
      ...(filters.activeOnly === false ? {} : { isActive: true }),
    },
    orderBy: [{ state: "asc" }, { wdNumber: "asc" }],
  });
  const county = filters.county?.toLowerCase();
  return rows
    .filter((row) => !county || asStringArray(row.counties).some((c) => c.toLowerCase() === county))
    .map(toDeterminationDTO);
}

export async function listRatesForDetermination(
  orgId: string,
  wdNumber: string,
): Promise<DavisBaconRateDTO[]> {
  const rows = await db().davisBaconRate.findMany({
    where: { orgId, wdNumber },
    orderBy: [{ occupation: "asc" }],
  });
  return rows.map(toRateDTO);
}

/** All rates for every determination covering a state/county. */
export async function listCountyRates(
  orgId: string,
  state: string,
  county: string,
): Promise<DavisBaconRateDTO[]> {
  const determinations = await listDeterminations(orgId, { state, county });
  const wdNumbers = determinations.map((d) => d.wdNumber);
  if (wdNumbers.length === 0) return [];
  const rows = await db().davisBaconRate.findMany({
    where: { orgId, wdNumber: { in: wdNumbers } },
    orderBy: [{ wdNumber: "asc" }, { occupation: "asc" }],
  });
  return rows.map(toRateDTO);
}
