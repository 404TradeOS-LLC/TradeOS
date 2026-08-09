import crypto, { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { basePrisma, prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { signAuthToken } from "../../backend/auth/jwt";
import { hashPassword, verifyPassword } from "../../backend/auth/password";
import { OrganizationProvisioningService } from "../organization-provisioning/service";
import {
  AcceptInviteInput,
  AuthSessionResult,
  InviteTeamMemberInput,
  InviteTeamMemberResult,
  LoginInput,
  PasswordResetRequestResult,
  RefreshSessionInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  SignupInput,
  SupabaseBootstrapInput,
} from "./types";
import { normalizeRole } from "../../domain";

const INVALID_CREDENTIALS = "Invalid email or password";
const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export class AuthService {
  private readonly provisioning = new OrganizationProvisioningService();

  async signup(input: SignupInput): Promise<AuthSessionResult> {
    const passwordHash = await hashPassword(input.password);
    const authSubject = `local:${randomUUID()}`;

    const result = await this.provisioning.provision({
      organizationName: input.organizationName,
      regionCode: input.regionCode,
      owner: {
        authSubject,
        email: input.email,
        fullName: input.fullName,
        passwordHash,
      },
    });

    return this.issueSession({
      userId: result.owner.userId,
      authSubject: result.owner.authSubject,
      email: result.owner.email,
      fullName: input.fullName ?? null,
      orgId: result.organization.id,
      orgName: result.organization.name,
      membershipId: result.owner.membershipId,
      role: result.owner.role,
    });
  }

  async login(input: LoginInput): Promise<AuthSessionResult> {
    const normalizedEmail = input.email.toLowerCase();

    const result = await basePrisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`select set_config('app.login_lookup', 'true', true)`);

      const user = await transaction.appUser.findUnique({ where: { email: normalizedEmail } });
      if (!user || !user.isActive || !user.passwordHash) throw new ApiError(401, INVALID_CREDENTIALS);

      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) throw new ApiError(401, INVALID_CREDENTIALS);

      if (await this.hasPendingTotp(transaction, user.id)) {
        throw new ApiError(501, "TOTP 2FA is scaffolded but not enabled in this sprint");
      }

      await transaction.$queryRaw(Prisma.sql`select set_config('app.user_id', ${user.id}, true)`);

      const membership = await transaction.organizationMembership.findFirst({
        where: { userId: user.id, status: "active" },
        orderBy: { createdAt: "asc" },
      });
      if (!membership) throw new ApiError(401, INVALID_CREDENTIALS);

      await transaction.$queryRaw(Prisma.sql`select set_config('app.org_id', ${membership.orgId}, true)`);

      const organization = await transaction.organization.findUnique({ where: { id: membership.orgId } });
      if (!organization) throw new ApiError(401, INVALID_CREDENTIALS);

      return { user, membership, organization };
    });

    return this.issueSession({
      userId: result.user.id,
      authSubject: result.user.authSubject,
      email: result.user.email,
      fullName: result.user.fullName,
      orgId: result.membership.orgId,
      orgName: result.organization.name,
      membershipId: result.membership.id,
      role: result.membership.role,
    });
  }

  async refresh(input: RefreshSessionInput): Promise<AuthSessionResult> {
    const tokenHash = hashOpaqueToken(input.refreshToken);

    return basePrisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`select set_config('app.login_lookup', 'true', true)`);

      const existing = await transaction.authRefreshToken.findUnique({
        where: { tokenHash },
      });
      if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) {
        throw new ApiError(401, "Invalid refresh token");
      }

      await transaction.$queryRaw(Prisma.sql`
        select
          set_config('app.user_id', ${existing.userId}, true),
          set_config('app.org_id', ${existing.orgId}, true)
      `);

      const membership = await transaction.organizationMembership.findFirst({
        where: { id: existing.membershipId, userId: existing.userId, orgId: existing.orgId, status: "active" },
      });
      if (!membership) throw new ApiError(401, "Invalid refresh token");

      const user = await transaction.appUser.findUnique({ where: { id: existing.userId } });
      const organization = await transaction.organization.findUnique({ where: { id: existing.orgId } });
      if (!user || !organization) throw new ApiError(401, "Invalid refresh token");

      const replacementToken = createOpaqueToken();
      const replacementHash = hashOpaqueToken(replacementToken);
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

      await transaction.authRefreshToken.update({
        where: { id: existing.id },
        data: {
          revokedAt: new Date(),
          lastUsedAt: new Date(),
          replacedById: replacementHash,
        },
      });

      await transaction.authRefreshToken.create({
        data: {
          orgId: existing.orgId,
          userId: existing.userId,
          membershipId: existing.membershipId,
          tokenHash: replacementHash,
          expiresAt,
        },
      });

      return this.buildSessionResult(
        {
          userId: user.id,
          authSubject: user.authSubject,
          email: user.email,
          fullName: user.fullName,
          orgId: organization.id,
          orgName: organization.name,
          membershipId: membership.id,
          role: membership.role,
        },
        replacementToken
      );
    });
  }

  async requestPasswordReset(input: RequestPasswordResetInput): Promise<PasswordResetRequestResult> {
    const normalizedEmail = input.email.toLowerCase();

    const token = await basePrisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`select set_config('app.login_lookup', 'true', true)`);

      const user = await transaction.appUser.findUnique({ where: { email: normalizedEmail } });
      if (!user || !user.isActive) {
        return null;
      }

      await transaction.$queryRaw(Prisma.sql`select set_config('app.user_id', ${user.id}, true)`);
      const rawToken = createOpaqueToken();
      await transaction.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(rawToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });
      return rawToken;
    });

    return {
      success: true,
      ...(token && process.env.NODE_ENV !== "production" ? { resetToken: token } : {}),
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ success: true }> {
    const tokenHash = hashOpaqueToken(input.token);
    const passwordHash = await hashPassword(input.password);

    await basePrisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`select set_config('app.login_lookup', 'true', true)`);
      const row = await transaction.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!row || row.consumedAt || row.expiresAt <= new Date()) {
        throw new ApiError(400, "Password reset token is invalid or expired");
      }

      await transaction.$queryRaw(Prisma.sql`select set_config('app.user_id', ${row.userId}, true)`);
      await transaction.appUser.update({
        where: { id: row.userId },
        data: { passwordHash },
      });
      await transaction.passwordResetToken.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      });
    });

    return { success: true };
  }

  async inviteTeamMember(input: InviteTeamMemberInput): Promise<InviteTeamMemberResult> {
    if (!["dispatcher", "technician"].includes(input.role)) {
      throw new ApiError(400, "Invites are limited to Dispatcher and Technician roles in this sprint");
    }

    const rawToken = createOpaqueToken();
    const invite = await prisma.organizationInvite.create({
      data: {
        orgId: input.orgId,
        invitedByUserId: input.invitedByUserId,
        email: input.email.toLowerCase(),
        role: input.role,
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    return {
      inviteId: invite.id,
      email: invite.email,
      role: invite.role as InviteTeamMemberResult["role"],
      expiresAt: invite.expiresAt,
      ...(process.env.NODE_ENV !== "production" ? { inviteToken: rawToken } : {}),
    };
  }

  async acceptInvite(input: AcceptInviteInput): Promise<AuthSessionResult> {
    const tokenHash = hashOpaqueToken(input.token);
    const passwordHash = await hashPassword(input.password);

    return basePrisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`select set_config('app.login_lookup', 'true', true)`);

      const invite = await transaction.organizationInvite.findUnique({ where: { tokenHash } });
      if (!invite || invite.acceptedAt || invite.expiresAt <= new Date() || invite.status !== "pending") {
        throw new ApiError(400, "Invite is invalid or expired");
      }

      let user = await transaction.appUser.findUnique({ where: { email: invite.email } });
      if (user && !user.isActive) {
        user = await transaction.appUser.update({
          where: { id: user.id },
          data: { isActive: true, passwordHash, fullName: input.fullName ?? user.fullName },
        });
      } else if (user) {
        user = await transaction.appUser.update({
          where: { id: user.id },
          data: { passwordHash, fullName: input.fullName ?? user.fullName },
        });
      } else {
        user = await transaction.appUser.create({
          data: {
            authSubject: `local:${randomUUID()}`,
            email: invite.email,
            fullName: input.fullName,
            passwordHash,
          },
        });
      }

      await transaction.$queryRaw(Prisma.sql`
        select
          set_config('app.user_id', ${user.id}, true),
          set_config('app.org_id', ${invite.orgId}, true)
      `);

      const membership = await transaction.organizationMembership.upsert({
        where: {
          orgId_userId: {
            orgId: invite.orgId,
            userId: user.id,
          },
        },
        update: {
          role: invite.role,
          status: "active",
        },
        create: {
          orgId: invite.orgId,
          userId: user.id,
          role: invite.role,
          status: "active",
        },
      });

      const organization = await transaction.organization.findUnique({ where: { id: invite.orgId } });
      if (!organization) throw new ApiError(404, `Organization ${invite.orgId} not found`);

      const refreshToken = createOpaqueToken();
      await transaction.authRefreshToken.create({
        data: {
          orgId: organization.id,
          userId: user.id,
          membershipId: membership.id,
          tokenHash: hashOpaqueToken(refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      });

      await transaction.organizationInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), status: "accepted" },
      });

      return this.buildSessionResult(
        {
          userId: user.id,
          authSubject: user.authSubject,
          email: user.email,
          fullName: user.fullName,
          orgId: organization.id,
          orgName: organization.name,
          membershipId: membership.id,
          role: membership.role,
        },
        refreshToken
      );
    });
  }

  async bootstrapSupabaseIdentity(input: SupabaseBootstrapInput) {
    const normalizedEmail = input.email.toLowerCase();

    // Mirrors login()'s three-step app.login_lookup -> app.user_id -> app.org_id
    // pattern (see the RLS policies added in migration
    // 20260624120000_add_users_login_lookup_policy and hardened in
    // 20260804020000_harden_database_security_boundaries). This lookup runs
    // before any identity/org context is known, so without explicitly
    // setting these session-local flags, organization_memberships' and
    // organizations' RLS policies silently return zero rows regardless of
    // what actually exists — a single un-flagged basePrisma.appUser.findFirst
    // with a nested `include` (the previous implementation here) can see the
    // user row but never their membership or organization, so every already
    // -provisioned identity's second-and-later bootstrap call falsely hit the
    // "no active membership" branch below. Confirmed against production: the
    // real hello@404tradeos.com account was fully provisioned (owner role,
    // active membership) yet got this exact false 409 on every login after
    // the one that provisioned it.
    const existing = await basePrisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`select set_config('app.login_lookup', 'true', true)`);

      const user = await transaction.appUser.findFirst({
        where: { OR: [{ authSubject: input.authSubject }, { email: normalizedEmail }] },
      });
      if (!user) return null;

      await transaction.$queryRaw(Prisma.sql`select set_config('app.user_id', ${user.id}, true)`);

      const membership = await transaction.organizationMembership.findFirst({
        where: { userId: user.id, status: "active" },
        orderBy: { createdAt: "asc" },
      });
      if (!membership) return { user, membership: null, organization: null };

      await transaction.$queryRaw(Prisma.sql`select set_config('app.org_id', ${membership.orgId}, true)`);

      const organization = await transaction.organization.findUnique({ where: { id: membership.orgId } });

      return { user, membership, organization };
    });

    if (existing) {
      if (!existing.membership || !existing.organization) {
        throw new ApiError(409, "User exists but has no active organization membership");
      }
      return {
        user: { id: existing.user.id, email: existing.user.email, fullName: existing.user.fullName },
        organization: { id: existing.organization.id, name: existing.organization.name },
        role: existing.membership.role,
      };
    }

    if (!input.organizationName) {
      // `details.code` is a stable, machine-readable discriminator (message
      // text alone is not something callers should parse) — the frontend
      // uses it to route an authenticated-but-unprovisioned identity to a
      // "finish setup" screen instead of either failing silently or
      // redirecting to a dashboard that will 403 on every request.
      throw new ApiError(400, "organizationName is required to create a new organization", { code: "organization_name_required" });
    }

    const provisioned = await this.provisioning.provision({
      organizationName: input.organizationName,
      regionCode: input.regionCode,
      owner: {
        authSubject: input.authSubject,
        email: normalizedEmail,
        fullName: input.fullName,
      },
    });

    return {
      user: {
        id: provisioned.owner.userId,
        email: provisioned.owner.email,
        fullName: input.fullName ?? null,
      },
      organization: {
        id: provisioned.organization.id,
        name: provisioned.organization.name,
      },
      role: provisioned.owner.role,
    };
  }

  async getTotpSetupStatus(userId: string): Promise<{ enabled: boolean; message: string }> {
    const row = await prisma.userTotpCredential.findUnique({ where: { userId } });
    return {
      enabled: Boolean(row?.enabledAt),
      message: "TOTP storage is scaffolded. Secret generation, verification, and recovery codes remain future work.",
    };
  }

  private async issueSession(context: SessionContext): Promise<AuthSessionResult> {
    const refreshToken = createOpaqueToken();
    await basePrisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`
        select
          set_config('app.login_lookup', 'true', true),
          set_config('app.user_id', ${context.userId}, true),
          set_config('app.org_id', ${context.orgId}, true)
      `);
      await transaction.authRefreshToken.create({
        data: {
          orgId: context.orgId,
          userId: context.userId,
          membershipId: context.membershipId,
          tokenHash: hashOpaqueToken(refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      });
    });

    return this.buildSessionResult(context, refreshToken);
  }

  private buildSessionResult(context: SessionContext, refreshToken: string): AuthSessionResult {
    const token = signAuthToken(
      {
        sub: context.authSubject,
        email: context.email,
        orgId: context.orgId,
        role: normalizeRole(context.role),
      },
      requireSecret()
    );

    return {
      token,
      refreshToken,
      user: { id: context.userId, email: context.email, fullName: context.fullName },
      organization: { id: context.orgId, name: context.orgName },
      role: normalizeRole(context.role),
    };
  }

  private async hasPendingTotp(
    transaction: {
      userTotpCredential: {
        findUnique(args: { where: { userId: string } }): Promise<{ enabledAt: Date | null } | null>;
      };
    },
    userId: string
  ): Promise<boolean> {
    const row = await transaction.userTotpCredential.findUnique({ where: { userId } });
    return Boolean(row?.enabledAt);
  }
}

interface SessionContext {
  userId: string;
  authSubject: string;
  email: string;
  fullName: string | null;
  orgId: string;
  orgName: string;
  membershipId: string;
  role: string;
}

function requireSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) throw new ApiError(500, "AUTH_JWT_SECRET is not configured");
  return secret;
}

function createOpaqueToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
