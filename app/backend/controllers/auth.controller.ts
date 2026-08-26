import { Request, Response } from "express";
import { z } from "zod";
import { AuthService } from "../../modules/auth/service";
import { verifyAnyAuthToken } from "../auth/jwt";
import { ApiError } from "../middleware/errorHandler";
import { requireAuthContext, requireOrgId, requireRoles } from "../requestContext";

const service = new AuthService();

const signupSchema = z
  .object({
    organizationName: z.string().trim().min(1).max(160),
    regionCode: z.string().trim().min(1).max(64).optional(),
    email: z.string().trim().email().max(320),
    password: z.string().min(8).max(200),
    fullName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(200),
  })
  .strict();

const bootstrapSchema = z
  .object({
    // Optional: only required to provision a brand-new organization. A
    // caller who already has an active membership is returned that
    // existing state regardless of whether this is present (see
    // AuthService.bootstrapSupabaseIdentity) — this lets the frontend
    // safely call bootstrap on every login, not just right after signup.
    organizationName: z.string().trim().min(1).max(160).optional(),
    regionCode: z.string().trim().min(1).max(64).optional(),
    fullName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).max(512),
  })
  .strict();

const requestResetSchema = z
  .object({
    email: z.string().trim().email().max(320),
  })
  .strict();

const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(512),
    password: z.string().min(8).max(200),
  })
  .strict();

const inviteSchema = z
  .object({
    email: z.string().trim().email().max(320),
    role: z.enum(["dispatcher", "technician"]),
  })
  .strict();

const acceptInviteSchema = z
  .object({
    token: z.string().min(1).max(512),
    password: z.string().min(8).max(200),
    fullName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const authController = {
  async signup(req: Request, res: Response) {
    const input = signupSchema.parse(req.body);
    res.status(201).json(await service.signup(input));
  },
  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    res.json(await service.login(input));
  },
  async refresh(req: Request, res: Response) {
    res.json(await service.refresh(refreshSchema.parse(req.body)));
  },
  async bootstrap(req: Request, res: Response) {
    const input = bootstrapSchema.parse(req.body);
    const token = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new ApiError(401, "Missing bearer token");

    const claims = await verifyAnyAuthToken(token);
    if (!claims.email) throw new ApiError(400, "Authenticated identity is missing an email address");

    res.status(201).json(
      await service.bootstrapSupabaseIdentity({
        organizationName: input.organizationName,
        regionCode: input.regionCode,
        fullName: input.fullName,
        authSubject: claims.sub,
        email: claims.email,
      })
    );
  },
  async requestPasswordReset(req: Request, res: Response) {
    res.json(await service.requestPasswordReset(requestResetSchema.parse(req.body)));
  },
  async resetPassword(req: Request, res: Response) {
    res.json(await service.resetPassword(resetPasswordSchema.parse(req.body)));
  },
  async logout(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    await service.logout(auth.userId);
    res.status(204).send();
  },
  async invite(req: Request, res: Response) {
    const auth = requireRoles(req, ["owner"]);
    const input = inviteSchema.parse(req.body);
    res.status(201).json(
      await service.inviteTeamMember({
        orgId: requireOrgId(req),
        invitedByUserId: auth.userId,
        email: input.email,
        role: input.role,
      })
    );
  },
  async acceptInvite(req: Request, res: Response) {
    res.status(201).json(await service.acceptInvite(acceptInviteSchema.parse(req.body)));
  },
  async totpStatus(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    res.json(await service.getTotpSetupStatus(auth.userId));
  },
};
