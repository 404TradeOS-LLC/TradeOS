import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../backend/auth/password";

type BootstrapRole = "owner" | "admin";

export interface BootstrapAdminConfig {
  enabled: boolean;
  databaseAdminUrl?: string;
  email?: string;
  password?: string;
  fullName?: string;
  organizationName?: string;
  role?: BootstrapRole;
}

export function parseBootstrapAdminConfig(env: NodeJS.ProcessEnv): BootstrapAdminConfig {
  const enabled = env.BOOTSTRAP_ADMIN_ENABLED === "true";
  if (!enabled) return { enabled: false };

  const databaseAdminUrl = required(env.DATABASE_ADMIN_URL, "DATABASE_ADMIN_URL");
  const email = required(env.BOOTSTRAP_ADMIN_EMAIL, "BOOTSTRAP_ADMIN_EMAIL").trim().toLowerCase();
  const password = required(env.BOOTSTRAP_ADMIN_PASSWORD, "BOOTSTRAP_ADMIN_PASSWORD");
  const fullName = required(env.BOOTSTRAP_ADMIN_NAME, "BOOTSTRAP_ADMIN_NAME").trim();
  const organizationName = required(env.BOOTSTRAP_ADMIN_ORG_NAME, "BOOTSTRAP_ADMIN_ORG_NAME").trim();
  const role = parseRole(env.BOOTSTRAP_ADMIN_ROLE);

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address");
  }
  if (password.length < 14) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 14 characters");
  }

  return { enabled, databaseAdminUrl, email, password, fullName, organizationName, role };
}

export async function bootstrapAdmin(config: BootstrapAdminConfig): Promise<void> {
  if (!config.enabled) {
    console.log("Admin bootstrap is disabled; no changes made.");
    return;
  }

  const databaseAdminUrl = config.databaseAdminUrl as string;
  const email = config.email as string;
  const password = config.password as string;
  const fullName = config.fullName as string;
  const organizationName = config.organizationName as string;
  const role = config.role as BootstrapRole;

  const adminPrisma = new PrismaClient({
    datasources: { db: { url: databaseAdminUrl } },
  });

  try {
    const organizations = await adminPrisma.organization.findMany({
      where: { name: organizationName },
      select: { id: true, name: true },
      take: 2,
    });

    if (organizations.length === 0) {
      throw new Error(`No organization named "${organizationName}" exists; refusing to create a duplicate organization.`);
    }
    if (organizations.length > 1) {
      throw new Error(`More than one organization named "${organizationName}" exists; use a unique organization name before bootstrapping.`);
    }

    const organization = organizations[0];
    const passwordHash = await hashPassword(password);

    const result = await adminPrisma.$transaction(async (tx) => {
      const existingUser = await tx.appUser.findUnique({ where: { email } });

      const user = existingUser
        ? await tx.appUser.update({
            where: { id: existingUser.id },
            data: { fullName, passwordHash, isActive: true },
          })
        : await tx.appUser.create({
            data: {
              authSubject: `local:bootstrap:${randomUUID()}`,
              email,
              fullName,
              passwordHash,
              isActive: true,
            },
          });

      const previousMembership = await tx.organizationMembership.findUnique({
        where: { orgId_userId: { orgId: organization.id, userId: user.id } },
      });

      const membership = await tx.organizationMembership.upsert({
        where: { orgId_userId: { orgId: organization.id, userId: user.id } },
        update: { role, status: "active" },
        create: { orgId: organization.id, userId: user.id, role, status: "active" },
      });

      await tx.organizationMembershipAudit.create({
        data: {
          orgId: organization.id,
          membershipId: membership.id,
          userId: user.id,
          action: previousMembership ? "bootstrap_updated" : "bootstrap_created",
          actorUserId: user.id,
          actorRole: role,
          beforeState: previousMembership
            ? {
                role: previousMembership.role,
                status: previousMembership.status,
              }
            : undefined,
          afterState: {
            role: membership.role,
            status: membership.status,
            bootstrap: true,
          },
        },
      });

      return { userId: user.id, membershipId: membership.id };
    });

    console.log(
      `Admin bootstrap complete for ${email} in ${organization.name} as ${role} (user ${result.userId}, membership ${result.membershipId}).`
    );
    console.log("No password or password hash was printed. Set BOOTSTRAP_ADMIN_ENABLED=false after verification.");
  } finally {
    await adminPrisma.$disconnect();
  }
}

function required(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") throw new Error(`${name} is required when BOOTSTRAP_ADMIN_ENABLED=true`);
  return value;
}

function parseRole(value: string | undefined): BootstrapRole {
  const role = (value ?? "admin").trim().toLowerCase();
  if (role !== "admin" && role !== "owner") {
    throw new Error("BOOTSTRAP_ADMIN_ROLE must be either admin or owner");
  }
  return role;
}

if (require.main === module) {
  bootstrapAdmin(parseBootstrapAdminConfig(process.env)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown admin bootstrap failure";
    console.error(`Admin bootstrap failed: ${message}`);
    process.exitCode = 1;
  });
}
