import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { basePrisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { ProvisionOrganizationInput, ProvisionOrganizationResult } from "./types";

export class OrganizationProvisioningService {
  async provision(input: ProvisionOrganizationInput): Promise<ProvisionOrganizationResult> {
    const orgId = randomUUID();
    const normalizedEmail = input.owner.email.toLowerCase();

    return basePrisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`
        select
          set_config('app.provisioning', 'true', true),
          set_config('app.org_id', ${orgId}, true),
          set_config('app.role', 'owner', true),
          set_config('app.session_source', 'platform:provisioning', true)
      `);

      const conflictingUser = await transaction.appUser.findFirst({
        where: {
          OR: [{ authSubject: input.owner.authSubject }, { email: normalizedEmail }],
        },
      });
      if (conflictingUser) {
        throw new ApiError(409, "Owner identity or email is already provisioned");
      }

      const organization = await transaction.organization.create({
        data: {
          id: orgId,
          name: input.organizationName,
          regionCode: input.regionCode,
        },
      });
      const user = await transaction.appUser.create({
        data: {
          authSubject: input.owner.authSubject,
          email: normalizedEmail,
          fullName: input.owner.fullName,
          passwordHash: input.owner.passwordHash,
        },
      });

      await transaction.$queryRaw(Prisma.sql`
        select set_config('app.user_id', ${user.id}, true)
      `);

      const membership = await transaction.organizationMembership.create({
        data: {
          orgId,
          userId: user.id,
          role: "owner",
          status: "active",
        },
      });
      const snapshot = {
        membershipId: membership.id,
        userId: user.id,
        authSubject: user.authSubject,
        email: user.email,
        fullName: user.fullName,
        role: "owner",
        status: "active",
        createdAt: membership.createdAt.toISOString(),
        updatedAt: membership.updatedAt.toISOString(),
      };
      await transaction.organizationMembershipAudit.create({
        data: {
          orgId,
          membershipId: membership.id,
          userId: user.id,
          action: "created",
          actorUserId: user.id,
          actorRole: "owner",
          afterState: snapshot,
        },
      });

      return {
        organization: {
          id: organization.id,
          name: organization.name,
          regionCode: organization.regionCode,
        },
        owner: {
          userId: user.id,
          membershipId: membership.id,
          authSubject: user.authSubject,
          email: user.email,
          role: "owner",
          status: "active",
        },
      };
    });
  }
}
