import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { burdenedLaborRate, laborCost, laborHours } from "../estimate-engine/formulas";
import {
  CalculateLaborCostInput,
  CalculateLaborCostOutput,
  CreateLaborRateInput,
  LaborRateDTO,
  UpdateLaborRateInput,
} from "./types";

// Labor Database module: trade labor classifications, production rates,
// burdened labor rates, and regional modifiers (Deliverable 4 — labor_rates table).
export class LaborDatabaseService {
  async list(orgId?: string): Promise<LaborRateDTO[]> {
    const rows = await prisma.laborRate.findMany({
      where: orgId ? { orgId, active: true } : { active: true },
      include: { region: true },
      orderBy: { role: "asc" },
    });
    return rows.map(toDTO);
  }

  async getById(id: string, orgId?: string): Promise<LaborRateDTO> {
    const row = await prisma.laborRate.findFirst({ where: { id, orgId, active: true }, include: { region: true } });
    if (!row) throw new ApiError(404, `LaborRate ${id} not found`);
    return toDTO(row);
  }

  async create(input: CreateLaborRateInput): Promise<LaborRateDTO> {
    const row = await prisma.laborRate.create({
      data: {
        orgId: input.orgId,
        role: input.trade,
        description: null,
        hourlyCost: input.baseHourlyRate,
        billRate: input.baseHourlyRate,
        active: true,
        trade: input.trade,
        baseHourlyRate: input.baseHourlyRate,
        burdenPct: input.burdenPct ?? 0,
        regionId: input.regionId,
      },
      include: { region: true },
    });
    return toDTO(row);
  }

  async update(id: string, input: UpdateLaborRateInput, orgId?: string): Promise<LaborRateDTO> {
    await this.assertExists(id, orgId);
    const row = await prisma.laborRate.update({
      where: { id },
      data: {
        role: input.trade,
        hourlyCost: input.baseHourlyRate,
        billRate: input.baseHourlyRate,
        trade: input.trade,
        baseHourlyRate: input.baseHourlyRate,
        burdenPct: input.burdenPct,
        regionId: input.regionId,
      },
      include: { region: true },
    });
    return toDTO(row);
  }

  async delete(id: string, orgId?: string): Promise<void> {
    await this.assertExists(id, orgId);
    await prisma.laborRate.update({ where: { id }, data: { active: false } });
  }

  /** Calculates labor hours, the burdened rate, and total labor cost for a given quantity. */
  async calculateLaborCost(input: CalculateLaborCostInput, orgId?: string): Promise<CalculateLaborCostOutput> {
    const rate = await prisma.laborRate.findFirst({ where: { id: input.laborRateId, orgId, active: true }, include: { region: true } });
    if (!rate) throw new ApiError(404, `LaborRate ${input.laborRateId} not found`);

    const regionLaborIndex = rate.region ? Number(rate.region.laborIndex) : 1;
    const hours = laborHours(input.quantity, input.productionRate);
    const rateValue = burdenedLaborRate(Number(rate.baseHourlyRate), Number(rate.burdenPct), regionLaborIndex);
    const cost = laborCost({
      quantity: input.quantity,
      productionRate: input.productionRate,
      baseHourlyRate: Number(rate.baseHourlyRate),
      burdenPct: Number(rate.burdenPct),
      regionLaborIndex,
    });

    return { laborHours: hours, burdenedRate: rateValue, laborCost: cost };
  }

  private async assertExists(id: string, orgId?: string): Promise<void> {
    const exists = await prisma.laborRate.findFirst({ where: { id, orgId } });
    if (!exists) throw new ApiError(404, `LaborRate ${id} not found`);
  }
}

function toDTO(row: {
  id: string;
  orgId: string;
  trade: string;
  baseHourlyRate: unknown;
  burdenPct: unknown;
  regionId: string | null;
  region?: { laborIndex: unknown } | null;
}): LaborRateDTO {
  const regionLaborIndex = row.region ? Number(row.region.laborIndex) : 1;
  return {
    id: row.id,
    orgId: row.orgId,
    trade: row.trade,
    baseHourlyRate: Number(row.baseHourlyRate),
    burdenPct: Number(row.burdenPct),
    regionId: row.regionId,
    burdenedRate: burdenedLaborRate(Number(row.baseHourlyRate), Number(row.burdenPct), regionLaborIndex),
  };
}
