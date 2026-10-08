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
      select: { id: true, wdNumber: true, revisionNumber: true, modifiedDate: true },
    });
    return rows;
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

  async replaceRates({ determinationId, orgId, wdNumber, revisionNumber, rates }) {
    await db().davisBaconRate.deleteMany({ where: { determinationId } });
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
