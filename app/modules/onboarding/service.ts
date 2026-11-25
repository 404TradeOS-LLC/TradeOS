import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import {
  CompleteOnboardingInput,
  MAX_LABOR_RATE_CENTS,
  MAX_ONBOARDING_REGION_LENGTH,
  MAX_ONBOARDING_SCOPE_LENGTH,
  MAX_ONBOARDING_WORK_TYPES,
  MAX_ONBOARDING_WORK_TYPE_LENGTH,
  MIN_LABOR_RATE_CENTS,
  MIN_ONBOARDING_SCOPE_LENGTH,
  ONBOARDING_MAX_STEP,
  ONBOARDING_MIN_STEP,
  OnboardingStateDTO,
  OnboardingStatus,
  SaveOnboardingProgressInput,
} from "./types";

/**
 * DES-3 slice 2: persisted onboarding state.
 *
 * Organization scoping on every query; ApiError 400/401 guards; one row
 * per organization (upsert on orgId). No method here writes a Project,
 * Estimate, Contract, Proposal, Invoice, or Organization row — the
 * onboarding state is a new, attributable record; the wizard's labor
 * baseline and region live here, not on organizations.default_labor_rate
 * / region_code (owner-managed settings values the estimate engine reads
 * from neither today; wiring the engine to the persisted baseline is a
 * follow-up slice).
 *
 * Status transitions:
 * - saveProgress on an in_progress or skipped row keeps/sets in_progress
 *   (a skipped org that returns to the wizard resumes it) and clears
 *   skippedAt; on a completed row it updates the stored defaults without
 *   reopening onboarding (completed stays completed).
 * - skip sets skipped + skippedAt (clearing completedAt).
 * - complete sets completed + completedAt (clearing skippedAt).
 */
export class OnboardingService {
  constructor(private readonly db: typeof prisma = prisma) {}

  private requireOrgId(orgId: string | undefined | null): string {
    if (!orgId) throw new ApiError(401, "Organization is required");
    return orgId;
  }

  private validateProgressInput(input: SaveOnboardingProgressInput): void {
    if (input.currentStep !== undefined) {
      if (
        !Number.isInteger(input.currentStep) ||
        input.currentStep < ONBOARDING_MIN_STEP ||
        input.currentStep > ONBOARDING_MAX_STEP
      ) {
        throw new ApiError(400, "currentStep must be 1 or 2");
      }
    }
    if (input.workTypes !== undefined) {
      if (!Array.isArray(input.workTypes) || input.workTypes.length > MAX_ONBOARDING_WORK_TYPES) {
        throw new ApiError(400, "workTypes must be a list of at most 12 trades");
      }
      for (const workType of input.workTypes) {
        if (
          typeof workType !== "string" ||
          workType.trim().length === 0 ||
          workType.length > MAX_ONBOARDING_WORK_TYPE_LENGTH
        ) {
          throw new ApiError(400, "Each work type must be a non-empty trade name");
        }
      }
    }
    if (input.scopeText !== undefined && input.scopeText !== null) {
      if (typeof input.scopeText !== "string" || input.scopeText.length > MAX_ONBOARDING_SCOPE_LENGTH) {
        throw new ApiError(400, "scopeText is too long");
      }
    }
    if (input.laborRateCents !== undefined && input.laborRateCents !== null) {
      if (
        !Number.isInteger(input.laborRateCents) ||
        input.laborRateCents < MIN_LABOR_RATE_CENTS ||
        input.laborRateCents > MAX_LABOR_RATE_CENTS
      ) {
        throw new ApiError(400, "laborRateCents must be between 100 and 50000");
      }
    }
    if (input.region !== undefined && input.region !== null) {
      if (typeof input.region !== "string" || input.region.length > MAX_ONBOARDING_REGION_LENGTH) {
        throw new ApiError(400, "region is too long");
      }
    }
  }

  private toDTO(row: {
    orgId: string;
    status: string;
    currentStep: number;
    workTypes: string[];
    scopeText: string | null;
    laborRateCents: number | null;
    region: string | null;
    skippedAt: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
  }): OnboardingStateDTO {
    return {
      orgId: row.orgId,
      status: row.status as OnboardingStatus,
      currentStep: row.currentStep,
      workTypes: row.workTypes,
      scopeText: row.scopeText,
      laborRateCents: row.laborRateCents,
      region: row.region,
      skippedAt: row.skippedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getState(orgId: string | undefined | null): Promise<OnboardingStateDTO | null> {
    const org = this.requireOrgId(orgId);
    const row = await this.db.organizationOnboardingState.findUnique({ where: { orgId: org } });
    return row ? this.toDTO(row) : null;
  }

  async saveProgress(
    orgId: string | undefined | null,
    input: SaveOnboardingProgressInput,
  ): Promise<OnboardingStateDTO> {
    const org = this.requireOrgId(orgId);
    this.validateProgressInput(input);
    const existing = await this.db.organizationOnboardingState.findUnique({ where: { orgId: org } });
    const keepCompleted = existing?.status === "completed";
    const data = {
      currentStep: input.currentStep ?? existing?.currentStep ?? 1,
      workTypes: input.workTypes ?? existing?.workTypes ?? [],
      scopeText: input.scopeText !== undefined ? input.scopeText : (existing?.scopeText ?? null),
      laborRateCents:
        input.laborRateCents !== undefined ? input.laborRateCents : (existing?.laborRateCents ?? null),
      region: input.region !== undefined ? input.region : (existing?.region ?? null),
    };
    const row = await this.db.organizationOnboardingState.upsert({
      where: { orgId: org },
      create: { orgId: org, status: "in_progress", ...data },
      update: {
        ...data,
        ...(keepCompleted
          ? {}
          : { status: "in_progress", skippedAt: null }),
      },
    });
    return this.toDTO(row);
  }

  async skip(orgId: string | undefined | null): Promise<OnboardingStateDTO> {
    const org = this.requireOrgId(orgId);
    const row = await this.db.organizationOnboardingState.upsert({
      where: { orgId: org },
      create: { orgId: org, status: "skipped", skippedAt: new Date(), completedAt: null },
      update: { status: "skipped", skippedAt: new Date(), completedAt: null },
    });
    return this.toDTO(row);
  }

  async complete(
    orgId: string | undefined | null,
    input: CompleteOnboardingInput,
  ): Promise<OnboardingStateDTO> {
    const org = this.requireOrgId(orgId);
    if (!Array.isArray(input.workTypes) || input.workTypes.length === 0) {
      throw new ApiError(400, "Choose at least one type of work to continue.");
    }
    const scopeText = typeof input.scopeText === "string" ? input.scopeText.trim() : "";
    if (scopeText.length < MIN_ONBOARDING_SCOPE_LENGTH) {
      throw new ApiError(400, "Describe the job in a sentence or two so Athena has something real to draft from.");
    }
    this.validateProgressInput(input);
    const row = await this.db.organizationOnboardingState.upsert({
      where: { orgId: org },
      create: {
        orgId: org,
        status: "completed",
        currentStep: 2,
        workTypes: input.workTypes,
        scopeText,
        laborRateCents: input.laborRateCents ?? null,
        region: input.region ?? null,
        completedAt: new Date(),
        skippedAt: null,
      },
      update: {
        status: "completed",
        currentStep: 2,
        workTypes: input.workTypes,
        scopeText,
        laborRateCents: input.laborRateCents ?? null,
        region: input.region ?? null,
        completedAt: new Date(),
        skippedAt: null,
      },
    });
    return this.toDTO(row);
  }
}
