/**
 * Prisma-backed DavisBaconStore. All queries run inside the request's
 * RLS-scoped database session (getRequestDatabaseClient); the tables carry
 * org_id policies, so cross-org reads/writes are impossible here.
 */
import { Prisma } from "@prisma/client";
import { getRequestDatabaseClient } from "../../db/requestSession";
import type { DavisBaconStore } from "./davisBaconSync";

function db() {
  const client = getRequestDatabaseClient();
  if (!client) throw new Error("Davis-Bacon store requires an active database session");
  return client;
}

function toJsonArray(value: string[]): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export const prismaDavisBaconStore: DavisBaconStore = {
  async listDeterminations(orgId, state) {
    const rows = await db().davisBaconDetermination.findMany({
      where: { orgId, state },
      select: { id: true, wdNumber: true, revisionNumber: true, modifiedDate: true, counties: true, isActive: true },
    });
    return rows.map((row) => ({ ...row, counties: Array.isArray(row.counties) ? row.counties.filter((c): c is string => typeof c === "string") : [] }));
  },

  async upsertDetermination({ orgId, determination }) {
    const existing = await db().davisBaconDetermination.findUnique({
      where: { orgId_wdNumber: { orgId, wdNumber: determination.wdNumber } },
      select: { id: true },
    });
    const data = {
      revisionNumber: determination.revisionNumber,
      state: determination.state,
      stateName: determination.stateName || null,
      counties: toJsonArray(determination.counties),
      constructionTypes: toJsonArray(determination.constructionTypes),
      modifiedDate: determination.modifiedDate || null,
      isActive: determination.isActive,
      source: "sam.gov",
      fetchedAt: new Date(),
    };
    if (existing) {
      await db().davisBaconDetermination.update({
        where: { id: existing.id },
        data,
      });
      return { id: existing.id, created: false };
    }
    const created = await db().davisBaconDetermination.create({
      data: { orgId, wdNumber: determination.wdNumber, ...data },
      select: { id: true },
    });
    return { id: created.id, created: true };
  },

  async retireMissingCounty(orgId, state, county, seenWdNumbers) {
    const rows = await db().davisBaconDetermination.findMany({
      where: { orgId, state, isActive: true, wdNumber: { notIn: seenWdNumbers } },
      select: { id: true, counties: true },
    });
    let retired = 0;
    for (const row of rows) {
      const counties = Array.isArray(row.counties)
        ? row.counties.filter((c): c is string => typeof c === "string")
        : [];
      const remaining = counties.filter((c) => c.toLowerCase() !== county.toLowerCase());
      if (remaining.length === counties.length) continue;
      await db().davisBaconDetermination.update({
        where: { id: row.id, orgId },
        data: { counties: toJsonArray(remaining), isActive: remaining.length > 0 },
      });
      retired += 1;
    }
    return retired;
  },

  async replaceRates({ determinationId, orgId, wdNumber, revisionNumber, rates }) {
    await db().davisBaconRate.deleteMany({ where: { determinationId, orgId } });
    if (rates.length === 0) return 0;
    const result = await db().davisBaconRate.createMany({
      data: rates.map((rate) => ({
        orgId,
        determinationId,
        wdNumber,
        revisionNumber,
        rateIdentifier: rate.rateIdentifier,
        identifierDate: rate.identifierDate || null,
        occupation: rate.occupation,
        baseRate: rate.baseRate,
        rateUnit: rate.rateUnit,
        fringe: rate.fringe,
        fringeExpression: rate.fringeExpression ?? null,
      })),
    });
    return result.count;
  },
};
