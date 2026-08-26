import { Prisma, PrismaClient } from "@prisma/client";
import {
  getRequestDatabaseClient,
  runWithBackgroundDatabaseSession,
  runWithDatabaseSession,
} from "../db/requestSession";
import { resolveAuthContext } from "../backend/auth/session";
import type { SupportedRole } from "../domain";
import { OrganizationProvisioningService } from "../modules/organization-provisioning/service";
import { MaterialDatabaseService } from "../modules/material-database/service";
import { SupplierIntegrationService } from "../modules/supplier-integration/service";
import { runSupplierPriceSyncJob } from "../modules/supplier-integration/worker";
import { AssembliesDatabaseService } from "../modules/assemblies-database/service";
import { ProposalsService } from "../modules/proposals/service";
import { EstimateEngineService } from "../modules/estimate-engine/service";
import { InvoicesService } from "../modules/invoices/service";
import { CrmService } from "../modules/crm/service";
import { ContractsService } from "../modules/contracts/service";
import { JobsService } from "../modules/jobs/service";
import { AuthService } from "../modules/auth/service";
import { OrganizationSettingsService } from "../modules/settings/service";

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "10000000-0000-0000-0000-000000000001";
const orgB = "20000000-0000-0000-0000-000000000002";
const adminUser = "10000000-0000-0000-0000-000000000011";
const viewerUser = "10000000-0000-0000-0000-000000000012";
const technicianUser = "10000000-0000-0000-0000-000000000014";
const otherUser = "20000000-0000-0000-0000-000000000021";
const noMembershipUser = "10000000-0000-0000-0000-000000000022";
const disabledMembershipUser = "10000000-0000-0000-0000-000000000023";
const estimatorUser = "10000000-0000-0000-0000-000000000013";
const adminMembership = "10000000-0000-0000-0000-000000000031";
const viewerMembership = "10000000-0000-0000-0000-000000000032";
const technicianMembership = "10000000-0000-0000-0000-000000000034";
const otherMembership = "20000000-0000-0000-0000-000000000041";
const estimatorMembership = "10000000-0000-0000-0000-000000000033";
const disabledMembership = "10000000-0000-0000-0000-000000000035";
const divisionA = "10000000-0000-0000-0000-000000000051";
const divisionB = "20000000-0000-0000-0000-000000000052";
const materialA = "10000000-0000-0000-0000-000000000061";
const supplierA = "10000000-0000-0000-0000-000000000071";
const materialForSupplierQueue = "10000000-0000-0000-0000-000000000072";
const projectA = "10000000-0000-0000-0000-000000000081";
const projectB = "20000000-0000-0000-0000-000000000082";
const projectTaskA = "10000000-0000-0000-0000-000000000083";
const customerA = "10000000-0000-0000-0000-000000000084";
const customerB = "20000000-0000-0000-0000-000000000085";
const serviceAddressA = "10000000-0000-0000-0000-000000000086";
const serviceAddressB = "20000000-0000-0000-0000-000000000087";
const equipmentAssetA = "10000000-0000-0000-0000-000000000088";
const estimateA = "10000000-0000-0000-0000-000000000091";
const assemblyForEstimateA = "10000000-0000-0000-0000-000000000092";
const settingsA = "10000000-0000-0000-0000-000000000093";
const settingsB = "20000000-0000-0000-0000-000000000094";
const brandProfileA = "10000000-0000-0000-0000-000000000095";
const brandProfileB = "20000000-0000-0000-0000-000000000096";
const brandDocumentSettingsA = "10000000-0000-0000-0000-000000000097";
const brandDocumentSettingsB = "20000000-0000-0000-0000-000000000098";
const brandAssetA = "10000000-0000-0000-0000-000000000099";
const activityEventA = "10000000-0000-0000-0000-000000000100";
const notificationA = "10000000-0000-0000-0000-000000000101";
const attachmentA = "10000000-0000-0000-0000-000000000102";
const commentA = "10000000-0000-0000-0000-000000000103";
const tagA = "10000000-0000-0000-0000-000000000104";
const tagAssignmentA = "10000000-0000-0000-0000-000000000105";
const savedViewA = "10000000-0000-0000-0000-000000000106";
const recentItemA = "10000000-0000-0000-0000-000000000107";
const featureFlagA = "10000000-0000-0000-0000-000000000108";
const serviceAgreementA = "10000000-0000-0000-0000-000000000109";
const invoiceForPaymentA = "10000000-0000-0000-0000-000000000110";
const paymentA = "10000000-0000-0000-0000-000000000111";
const jobA = "10000000-0000-0000-0000-000000000112";
const jobB = "20000000-0000-0000-0000-000000000113";
const technicianAssignmentA = "10000000-0000-0000-0000-000000000114";
const inviteA = "10000000-0000-0000-0000-000000000115";
const refreshTokenA = "10000000-0000-0000-0000-000000000116";
const passwordResetTokenA = "10000000-0000-0000-0000-000000000117";
const replacementRefreshTokenA = "10000000-0000-0000-0000-000000000118";
const proposalDeclinedStatusA = "10000000-0000-0000-0000-000000000119";
const proposalRejectedStatusA = "10000000-0000-0000-0000-000000000120";
const proposalInvalidStatusA = "10000000-0000-0000-0000-000000000121";
const proposalConcurrencyA = "10000000-0000-0000-0000-000000000122";
const generationA = "10000000-0000-0000-0000-000000000123";
const generationB = "20000000-0000-0000-0000-000000000124";
const generationReviewA = "10000000-0000-0000-0000-000000000125";
const generationReviewB = "20000000-0000-0000-0000-000000000126";
const generationReviewViewer = "10000000-0000-0000-0000-000000000127";
const generationTechnician = "10000000-0000-0000-0000-000000000128";
const generationReviewTechnician = "10000000-0000-0000-0000-000000000129";

describe("live organization row-level security", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({
      data: [
        { id: orgA, name: "Org A" },
        { id: orgB, name: "Org B" },
      ],
    });
    await adminClient.appUser.createMany({
      data: [
        { id: adminUser, authSubject: "rls-admin", email: "rls-admin@example.com" },
        { id: viewerUser, authSubject: "rls-viewer", email: "rls-viewer@example.com" },
        { id: technicianUser, authSubject: "rls-technician", email: "rls-tech@example.com", fullName: "Assigned Technician" },
        { id: otherUser, authSubject: "rls-other", email: "rls-other@example.com" },
        { id: noMembershipUser, authSubject: "rls-no-membership", email: "rls-no-membership@example.com" },
        { id: disabledMembershipUser, authSubject: "rls-disabled-membership", email: "rls-disabled-membership@example.com" },
        { id: estimatorUser, authSubject: "rls-estimator", email: "rls-estimator@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: adminMembership, orgId: orgA, userId: adminUser, role: "admin", status: "active" },
        { id: viewerMembership, orgId: orgA, userId: viewerUser, role: "viewer", status: "active" },
        { id: technicianMembership, orgId: orgA, userId: technicianUser, role: "technician", status: "active" },
        { id: otherMembership, orgId: orgB, userId: otherUser, role: "owner", status: "active" },
        { id: disabledMembership, orgId: orgA, userId: disabledMembershipUser, role: "viewer", status: "disabled" },
        { id: estimatorMembership, orgId: orgA, userId: estimatorUser, role: "estimator", status: "active" },
      ],
    });
    await adminClient.organizationInvite.create({
      data: {
        id: inviteA,
        orgId: orgA,
        email: "invitee@example.com",
        role: "technician",
        tokenHash: "integration-invite-token-hash",
        invitedByUserId: adminUser,
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    });
    await adminClient.authRefreshToken.create({
      data: {
        id: refreshTokenA,
        orgId: orgA,
        userId: adminUser,
        membershipId: adminMembership,
        tokenHash: "integration-refresh-token-hash",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    });
    await adminClient.passwordResetToken.create({
      data: {
        id: passwordResetTokenA,
        userId: adminUser,
        tokenHash: "integration-password-reset-token-hash",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    });
    await adminClient.division.createMany({
      data: [
        { id: divisionA, orgId: orgA, code: "A", name: "Org A Division" },
        { id: divisionB, orgId: orgB, code: "B", name: "Org B Division" },
      ],
    });
    await adminClient.supplier.create({
      data: { id: supplierA, orgId: orgA, name: "Acme Building Supply" },
    });
    await adminClient.material.create({
      data: {
        id: materialA,
        orgId: orgA,
        name: "Ready Mix Concrete",
        unitOfMeasure: "CY",
        unitCost: 150,
        wasteFactorPct: 0,
      },
    });
    await adminClient.material.create({
      data: {
        id: materialForSupplierQueue,
        orgId: orgA,
        name: "Rebar, #4",
        unitOfMeasure: "LF",
        unitCost: 150,
        wasteFactorPct: 0,
        supplierId: supplierA,
      },
    });
    await adminClient.organizationMembershipAudit.create({
      data: {
        orgId: orgA,
        membershipId: viewerMembership,
        userId: viewerUser,
        action: "created",
        actorUserId: adminUser,
        actorRole: "admin",
        afterState: { membershipId: viewerMembership, role: "viewer", status: "active" },
      },
    });
    await adminClient.customer.createMany({
      data: [
        { id: customerA, orgId: orgA, name: "Org A Customer", email: "orga@example.com" },
        { id: customerB, orgId: orgB, name: "Org B Customer", email: "orgb@example.com" },
      ],
    });
    await adminClient.serviceAddress.createMany({
      data: [
        {
          id: serviceAddressA,
          orgId: orgA,
          customerId: customerA,
          label: "Primary",
          addressLine1: "101 Org A Street",
          city: "Indianapolis",
          state: "IN",
          postalCode: "46201",
          isPrimary: true,
        },
        {
          id: serviceAddressB,
          orgId: orgB,
          customerId: customerB,
          label: "Primary",
          addressLine1: "202 Org B Street",
          city: "Columbus",
          state: "OH",
          postalCode: "43004",
          isPrimary: true,
        },
      ],
    });
    await adminClient.customerEquipment.create({
      data: {
        id: equipmentAssetA,
        orgId: orgA,
        customerId: customerA,
        serviceAddressId: serviceAddressA,
        name: "Furnace",
        manufacturer: "Carrier",
        model: "X100",
        status: "active",
      },
    });
    await adminClient.project.createMany({
      data: [
        { id: projectA, orgId: orgA, customerId: customerA, name: "Org A Project" },
        { id: projectB, orgId: orgB, customerId: customerB, name: "Org B Project" },
      ],
    });
    await adminClient.projectTask.create({
      data: {
        id: projectTaskA,
        projectId: projectA,
        title: "Initial mobilization",
        status: "todo",
        priority: "medium",
      },
    });
    await adminClient.job.createMany({
      data: [
        {
          id: jobA,
          orgId: orgA,
          projectId: projectA,
          customerId: customerA,
          serviceAddressId: serviceAddressA,
          jobNumber: "JOB-2026-000001",
          title: "Org A Scheduled Job",
          description: "Assigned technician should be able to see this job only.",
          jobType: "HVAC Service",
          status: "scheduled",
          priority: "high",
          scheduledStart: new Date("2026-07-16T13:00:00.000Z"),
          scheduledEnd: new Date("2026-07-16T15:00:00.000Z"),
          estimatedDurationMinutes: 120,
          createdById: adminUser,
        },
        {
          id: jobB,
          orgId: orgB,
          projectId: projectB,
          customerId: customerB,
          serviceAddressId: serviceAddressB,
          jobNumber: "JOB-2026-000001",
          title: "Org B Scheduled Job",
          description: "Cross-tenant job isolation check.",
          jobType: "Electrical Service",
          status: "scheduled",
          priority: "medium",
          scheduledStart: new Date("2026-07-16T16:00:00.000Z"),
          scheduledEnd: new Date("2026-07-16T18:00:00.000Z"),
          estimatedDurationMinutes: 120,
          createdById: otherUser,
        },
      ],
    });
    await adminClient.jobAssignment.create({
      data: {
        id: technicianAssignmentA,
        orgId: orgA,
        jobId: jobA,
        userId: technicianUser,
        assignmentRole: "lead",
        isLead: true,
        assignedById: adminUser,
      },
    });
    await adminClient.assembly.create({
      data: { id: assemblyForEstimateA, orgId: orgA, code: "RLS-TEST-ASM", name: "RLS Test Assembly", unitOfMeasure: "CY" },
    });
    await adminClient.estimate.create({
      data: {
        id: estimateA,
        orgId: orgA,
        projectId: projectA,
        lineItems: {
          create: [{ assemblyId: assemblyForEstimateA, description: "Excavation", quantity: 10, unitOfMeasure: "CY", unitCost: 20, lineCost: 200 }],
        },
        subtotalCost: 200,
        totalPrice: 200,
      },
    });
    await adminClient.serviceAgreement.create({
      data: {
        id: serviceAgreementA,
        orgId: orgA,
        customerId: customerA,
        serviceAddressId: serviceAddressA,
        projectId: projectA,
        name: "Preventative Maintenance",
        status: "active",
        billingCadence: "monthly",
        amount: 99,
      },
    });
    await adminClient.organizationSettings.createMany({
      data: [
        {
          id: settingsA,
          orgId: orgA,
          settingsJson: { companyName: "Org A Settings", currency: "USD", emailNotifications: true },
        },
        {
          id: settingsB,
          orgId: orgB,
          settingsJson: { companyName: "Org B Settings", currency: "CAD", emailNotifications: false },
        },
      ],
    });
    await adminClient.brandProfile.createMany({
      data: [
        {
          id: brandProfileA,
          organizationId: orgA,
          companyDisplayName: "Org A Brand",
          primaryColor: "#112233",
          licenseNumber: "ORG-A-LIC",
          serviceAreasJson: ["Indianapolis"],
        },
        {
          id: brandProfileB,
          organizationId: orgB,
          companyDisplayName: "Org B Brand",
          primaryColor: "#334455",
        },
      ],
    });
    await adminClient.brandDocumentSettings.createMany({
      data: [
        {
          id: brandDocumentSettingsA,
          organizationId: orgA,
          brandProfileId: brandProfileA,
          showPoweredByTradeOS: false,
        },
        {
          id: brandDocumentSettingsB,
          organizationId: orgB,
          brandProfileId: brandProfileB,
          showPoweredByTradeOS: true,
        },
      ],
    });
    await adminClient.brandAsset.create({
      data: {
        id: brandAssetA,
        organizationId: orgA,
        brandProfileId: brandProfileA,
        type: "logo",
        label: "Org A primary logo",
        url: "https://cdn.example.com/org-a/logo.svg",
      },
    });
    await adminClient.activityEvent.create({
      data: {
        id: activityEventA,
        orgId: orgA,
        entityType: "project",
        entityId: projectA,
        eventType: "project.created",
        title: "Project created",
        actorUserId: adminUser,
      },
    });
    await adminClient.notification.create({
      data: {
        id: notificationA,
        orgId: orgA,
        entityType: "project",
        entityId: projectA,
        category: "ai_suggestion",
        title: "AI suggested a change order",
        body: "Check weather-related contingency",
        priority: "high",
        activityEventId: activityEventA,
        createdByUserId: adminUser,
      },
    });
    await adminClient.attachment.create({
      data: {
        id: attachmentA,
        orgId: orgA,
        entityType: "project",
        entityId: projectA,
        kind: "photo",
        fileName: "front-elevation.jpg",
        fileUrl: "https://cdn.example.com/front-elevation.jpg",
        uploadedByUserId: adminUser,
      },
    });
    await adminClient.comment.create({
      data: {
        id: commentA,
        orgId: orgA,
        entityType: "project",
        entityId: projectA,
        body: "Need permit confirmation before crew dispatch.",
        authorUserId: adminUser,
      },
    });
    await adminClient.tag.create({
      data: {
        id: tagA,
        orgId: orgA,
        name: "Urgent",
        slug: "urgent",
        color: "#f97316",
      },
    });
    await adminClient.tagAssignment.create({
      data: {
        id: tagAssignmentA,
        orgId: orgA,
        tagId: tagA,
        entityType: "project",
        entityId: projectA,
        assignedByUserId: adminUser,
      },
    });
    await adminClient.savedView.create({
      data: {
        id: savedViewA,
        orgId: orgA,
        entityType: "project",
        name: "High Priority Projects",
        filterJson: { status: ["active"], tags: ["urgent"] },
        createdByUserId: adminUser,
      },
    });
    await adminClient.recentItem.create({
      data: {
        id: recentItemA,
        orgId: orgA,
        userId: adminUser,
        entityType: "project",
        entityId: projectA,
        title: "Org A Project",
        href: "/projects/" + projectA,
      },
    });
    await adminClient.featureFlag.create({
      data: {
        id: featureFlagA,
        orgId: orgA,
        key: "intelligence-foundation",
        enabled: true,
        scopeType: "org",
        scopeKey: orgA,
      },
    });
    await adminClient.invoice.create({
      data: {
        id: invoiceForPaymentA,
        projectId: projectA,
        estimateId: estimateA,
        invoiceNumber: 99,
        type: "full",
        status: "sent",
        amount: 150,
      },
    });
    await adminClient.payment.create({
      data: {
        id: paymentA,
        orgId: orgA,
        invoiceId: invoiceForPaymentA,
        amount: 150,
        paymentDate: new Date("2026-07-01T00:00:00.000Z"),
        method: "card",
        status: "recorded",
      },
    });
    await adminClient.athenaGenerationRun.createMany({
      data: [
        {
          id: generationA,
          orgId: orgA,
          actorUserId: adminUser,
          requestId: "rls-generation-a",
          traceId: "rls-trace-a",
          provider: "fake",
          model: "fake",
          status: "succeeded",
          latencyMs: 1,
          retentionExpiresAt: new Date("2026-07-01T00:00:00.000Z"),
        },
        {
          id: generationB,
          orgId: orgB,
          actorUserId: otherUser,
          requestId: "rls-generation-b",
          traceId: "rls-trace-b",
          provider: "fake",
          model: "fake",
          status: "succeeded",
          latencyMs: 1,
          retentionExpiresAt: new Date("2026-07-01T00:00:00.000Z"),
        },
        {
          id: generationTechnician,
          orgId: orgA,
          actorUserId: technicianUser,
          requestId: "rls-generation-technician",
          traceId: "rls-trace-technician",
          provider: "fake",
          model: "fake",
          status: "succeeded",
          latencyMs: 1,
          retentionExpiresAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      ],
    });
    await adminClient.athenaGenerationReview.createMany({
      data: [
        {
          id: generationReviewA,
          orgId: orgA,
          generationId: generationA,
          reviewerUserId: adminUser,
          outcome: "accepted",
          reviewedAt: new Date("2026-07-01T00:01:00.000Z"),
        },
        {
          id: generationReviewB,
          orgId: orgB,
          generationId: generationB,
          reviewerUserId: otherUser,
          outcome: "rejected",
          reviewedAt: new Date("2026-07-01T00:01:00.000Z"),
        },
        {
          id: generationReviewViewer,
          orgId: orgA,
          generationId: generationA,
          reviewerUserId: viewerUser,
          outcome: "accepted",
          reviewedAt: new Date("2026-07-01T00:01:30.000Z"),
        },
        {
          id: generationReviewTechnician,
          orgId: orgA,
          generationId: generationTechnician,
          reviewerUserId: viewerUser,
          outcome: "accepted",
          reviewedAt: new Date("2026-07-01T00:01:45.000Z"),
        },
      ],
    });
  });

  afterAll(async () => {
    await Promise.all([appClient.$disconnect(), adminClient.$disconnect()]);
  });

  it("allows same-organization reads", async () => {
    const rows = await inSession(adminUser, orgA, "admin", async () => {
      return currentTransaction().division.findMany({ orderBy: { code: "asc" } });
    });

    expect(rows.map((row) => row.id)).toEqual([divisionA]);
  });

  it("hides cross-organization reads", async () => {
    const row = await inSession(adminUser, orgA, "admin", async () => {
      return currentTransaction().division.findUnique({ where: { id: divisionB } });
    });

    expect(row).toBeNull();
  });

  it("enforces generation metadata tenant and actor boundaries", async () => {
    const visible = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().athenaGenerationRun.findUnique({ where: { id: generationA } })
    );
    expect(visible?.orgId).toBe(orgA);

    const hiddenCrossOrg = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().athenaGenerationRun.findUnique({ where: { id: generationA } })
    );
    expect(hiddenCrossOrg).toBeNull();

    const hiddenPeerActor = await inSession(viewerUser, orgA, "viewer", async () =>
      currentTransaction().athenaGenerationRun.findUnique({ where: { id: generationA } })
    );
    expect(hiddenPeerActor).toBeNull();

    const viewerInserted = await inSession(viewerUser, orgA, "viewer", async () =>
      currentTransaction().athenaGenerationRun.create({
        data: {
          orgId: orgA,
          actorUserId: viewerUser,
          requestId: "rls-generation-viewer-owned",
          traceId: "rls-trace-viewer-owned",
          provider: "fake",
          model: "fake",
          status: "succeeded",
          latencyMs: 1,
          retentionExpiresAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      })
    );
    expect(viewerInserted.actorUserId).toBe(viewerUser);

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().athenaGenerationRun.create({
          data: {
            orgId: orgA,
            actorUserId: adminUser,
            requestId: "rls-generation-viewer",
            traceId: "rls-trace-viewer",
            provider: "fake",
            model: "fake",
            status: "succeeded",
            latencyMs: 1,
            retentionExpiresAt: new Date("2026-07-01T00:00:00.000Z"),
          },
        })
      )
    ).rejects.toThrow();
  });

  it("enforces generation review tenant, reviewer, and append-only boundaries", async () => {
    const visible = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().athenaGenerationReview.findUnique({ where: { id: generationReviewA } })
    );
    expect(visible?.orgId).toBe(orgA);

    const hiddenCrossOrg = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().athenaGenerationReview.findUnique({ where: { id: generationReviewA } })
    );
    expect(hiddenCrossOrg).toBeNull();

    const hiddenPeer = await inSession(viewerUser, orgA, "viewer", async () =>
      currentTransaction().athenaGenerationReview.findUnique({ where: { id: generationReviewA } })
    );
    expect(hiddenPeer).toBeNull();

    const reviewerOwned = await inSession(viewerUser, orgA, "viewer", async () =>
      currentTransaction().athenaGenerationReview.findUnique({ where: { id: generationReviewViewer } })
    );
    expect(reviewerOwned?.reviewerUserId).toBe(viewerUser);

    const actorOwned = await inSession(technicianUser, orgA, "technician", async () =>
      currentTransaction().athenaGenerationReview.findUnique({ where: { id: generationReviewTechnician } })
    );
    expect(actorOwned?.generationId).toBe(generationTechnician);

    const inserted = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().athenaGenerationReview.create({
        data: {
          orgId: orgA,
          generationId: generationA,
          reviewerUserId: adminUser,
          outcome: "amended",
          reviewedAt: new Date("2026-07-01T00:02:00.000Z"),
        },
      })
    );
    expect(inserted.orgId).toBe(orgA);
    expect(inserted.reviewerUserId).toBe(adminUser);

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().athenaGenerationReview.create({
          data: {
            orgId: orgA,
            generationId: generationA,
            reviewerUserId: viewerUser,
            outcome: "accepted",
            reviewedAt: new Date("2026-07-01T00:03:00.000Z"),
          },
        })
      )
    ).rejects.toThrow();

    await expect(
      inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().athenaGenerationReview.create({
          data: {
            orgId: orgA,
            generationId: generationA,
            reviewerUserId: viewerUser,
            outcome: "amended",
            reviewedAt: new Date("2026-07-01T00:03:30.000Z"),
          },
        })
      )
    ).rejects.toThrow();

    await expect(
      inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().athenaGenerationReview.update({
          where: { id: generationReviewA },
          data: { outcome: "rejected" },
        })
      )
    ).rejects.toThrow();

    const adminDelete = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().athenaGenerationReview.deleteMany({ where: { id: generationReviewA } })
    );
    expect(adminDelete.count).toBe(0);
  });

  it("allows only an organization administrator to delete generation metadata", async () => {
    const viewerDelete = await inSession(viewerUser, orgA, "viewer", async () =>
      currentTransaction().athenaGenerationRun.deleteMany({ where: { id: generationA } })
    );
    expect(viewerDelete.count).toBe(0);

    const adminDelete = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().athenaGenerationRun.deleteMany({ where: { id: generationA } })
    );
    expect(adminDelete.count).toBe(1);
  });

  it("keeps Prisma migration history inaccessible to the runtime role", async () => {
    const adminRows = await adminClient.$queryRaw<Array<{ migration_name: string }>>`
      select migration_name
      from public._prisma_migrations
      order by finished_at desc nulls last
      limit 1
    `;
    expect(adminRows).toHaveLength(1);

    await expect(
      appClient.$queryRaw`
        select migration_name
        from public._prisma_migrations
        limit 1
      `
    ).rejects.toThrow();
  });

  it("rejects auth-record identity reassignment during login lookup", async () => {
    await expect(
      inLoginLookupSession((transaction) =>
        transaction.organizationInvite.update({
          where: { id: inviteA },
          data: { orgId: orgB },
        })
      )
    ).rejects.toThrow("organization invite identity fields are immutable");

    await expect(
      inLoginLookupSession((transaction) =>
        transaction.authRefreshToken.update({
          where: { id: refreshTokenA },
          data: { userId: otherUser },
        })
      )
    ).rejects.toThrow("refresh token identity fields are immutable");

    await expect(
      inLoginLookupSession((transaction) =>
        transaction.passwordResetToken.update({
          where: { id: passwordResetTokenA },
          data: { userId: otherUser },
        })
      )
    ).rejects.toThrow("password reset token identity fields are immutable");
  });

  it("preserves legitimate invite, refresh-token, and password-reset updates", async () => {
    const acceptedAt = new Date("2026-08-04T02:10:00.000Z");
    const revokedAt = new Date("2026-08-04T02:11:00.000Z");
    const consumedAt = new Date("2026-08-04T02:12:00.000Z");

    const invite = await inLoginLookupSession((transaction) =>
      transaction.organizationInvite.update({
        where: { id: inviteA },
        data: { acceptedAt, status: "accepted" },
      })
    );
    expect(invite).toMatchObject({ id: inviteA, orgId: orgA, acceptedAt, status: "accepted" });

    const refreshToken = await inLoginLookupSession((transaction) =>
      transaction.authRefreshToken.update({
        where: { id: refreshTokenA },
        data: { revokedAt, lastUsedAt: revokedAt, replacedById: replacementRefreshTokenA },
      })
    );
    expect(refreshToken).toMatchObject({
      id: refreshTokenA,
      orgId: orgA,
      userId: adminUser,
      revokedAt,
      lastUsedAt: revokedAt,
      replacedById: replacementRefreshTokenA,
    });

    const passwordResetToken = await inLoginLookupSession((transaction) =>
      transaction.passwordResetToken.update({
        where: { id: passwordResetTokenA },
        data: { consumedAt },
      })
    );
    expect(passwordResetToken).toMatchObject({
      id: passwordResetTokenA,
      userId: adminUser,
      consumedAt,
    });
  });

  it("enforces organization settings visibility and admin-only writes", async () => {
    const visibleSettings = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().organizationSettings.findUnique({ where: { orgId: orgA } })
    );
    expect(visibleSettings?.orgId).toBe(orgA);

    const hiddenSettings = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().organizationSettings.findUnique({ where: { orgId: orgA } })
    );
    expect(hiddenSettings).toBeNull();

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().organizationSettings.update({
          where: { orgId: orgA },
          data: { settingsJson: { companyName: "Viewer Blocked" } },
        })
      )
    ).rejects.toThrow();

    const updatedSettings = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().organizationSettings.update({
        where: { orgId: orgA },
        data: { settingsJson: { companyName: "Org A Updated", currency: "USD", emailNotifications: true } },
      })
    );
    expect(updatedSettings.orgId).toBe(orgA);
  });

  it("keeps the Settings adapter canonical read and tenant boundary inside request-scoped RLS", async () => {
    const service = new OrganizationSettingsService();
    const visible = await inSession(adminUser, orgA, "admin", async () =>
      service.getSettings(orgA, { userId: adminUser, orgId: orgA, role: "admin" })
    );

    expect(visible.settings.companyName).toBe("Org A Brand");

    await expect(
      inSession(otherUser, orgB, "owner", async () =>
        service.getSettings(orgA, { userId: otherUser, orgId: orgB, role: "owner" })
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("enforces brand studio visibility and admin-only writes", async () => {
    const visibleProfile = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().brandProfile.findUnique({ where: { organizationId: orgA } })
    );
    expect(visibleProfile?.id).toBe(brandProfileA);

    const hiddenProfile = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().brandProfile.findUnique({ where: { organizationId: orgA } })
    );
    expect(hiddenProfile).toBeNull();

    const visibleAsset = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().brandAsset.findUnique({ where: { id: brandAssetA } })
    );
    expect(visibleAsset?.organizationId).toBe(orgA);

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().brandProfile.update({
          where: { organizationId: orgA },
          data: { companyDisplayName: "Viewer Blocked Brand" },
        })
      )
    ).rejects.toThrow();

    const updatedSettings = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().brandDocumentSettings.update({
        where: { organizationId: orgA },
        data: { showPoweredByTradeOS: true },
      })
    );
    expect(updatedSettings.showPoweredByTradeOS).toBe(true);

    await expect(
      inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().brandAsset.create({
          data: {
            organizationId: orgB,
            brandProfileId: brandProfileB,
            type: "logo",
            url: "https://cdn.example.com/cross-org/logo.svg",
          },
        })
      )
    ).rejects.toThrow();
  });

  it("enforces project task visibility and write permissions", async () => {
    const visibleTasks = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().projectTask.findMany({ orderBy: { createdAt: "asc" } })
    );
    expect(visibleTasks.map((row) => row.id)).toEqual([projectTaskA]);

    const hiddenTask = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().projectTask.findUnique({ where: { id: projectTaskA } })
    );
    expect(hiddenTask).toBeNull();

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().projectTask.create({
          data: {
            projectId: projectA,
            title: "Viewer blocked task",
            status: "todo",
            priority: "low",
          },
        })
      )
    ).rejects.toThrow();
  });

  it("limits technician job visibility to assigned jobs while preserving tenant isolation", async () => {
    const visibleJobs = await inSession(technicianUser, orgA, "technician", async () =>
      currentTransaction().job.findMany({ orderBy: { createdAt: "asc" } })
    );
    expect(visibleJobs.map((row) => row.id)).toEqual([jobA]);

    const hiddenOtherOrgJob = await inSession(technicianUser, orgA, "technician", async () =>
      currentTransaction().job.findUnique({ where: { id: jobB } })
    );
    expect(hiddenOtherOrgJob).toBeNull();

    const hiddenUnassignedJob = await inSession(viewerUser, orgA, "viewer", async () =>
      currentTransaction().job.findUnique({ where: { id: jobA } })
    );
    expect(hiddenUnassignedJob).toBeNull();
  });

  it("denies a cross-organization Job transition before any status or activity write", async () => {
    await expect(
      inSession(otherUser, orgB, "owner", async () =>
        new JobsService().dispatch(jobA, {
          orgId: orgB,
          actor: { userId: otherUser, orgId: orgB, role: "owner" },
        })
      )
    ).rejects.toMatchObject({ statusCode: 404, message: `Job ${jobA} not found` });

    const unchanged = await adminClient.job.findUnique({ where: { id: jobA }, select: { status: true } });
    expect(unchanged?.status).toBe("scheduled");
  });

  it("lets technicians read their assigned team and update only their own assignment rows", async () => {
    const visibleAssignments = await inSession(technicianUser, orgA, "technician", async () =>
      currentTransaction().jobAssignment.findMany({ where: { jobId: jobA }, orderBy: { createdAt: "asc" } })
    );
    expect(visibleAssignments.map((row) => row.id)).toEqual([technicianAssignmentA]);

    const accepted = await inSession(technicianUser, orgA, "technician", async () =>
      currentTransaction().jobAssignment.update({
        where: { id: technicianAssignmentA },
        data: { acceptedAt: new Date("2026-07-16T12:45:00.000Z") },
      })
    );
    expect(accepted.acceptedAt?.toISOString()).toBe("2026-07-16T12:45:00.000Z");

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().jobAssignment.update({
          where: { id: technicianAssignmentA },
          data: { declinedAt: new Date("2026-07-16T12:46:00.000Z") },
        })
      )
    ).rejects.toThrow();
  });

  it("enforces crm foundation tenant boundaries for service addresses, customer equipment, agreements, payments, and notes", async () => {
    const visibleAddress = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().serviceAddress.findUnique({ where: { id: serviceAddressA } })
    );
    expect(visibleAddress?.customerId).toBe(customerA);

    const hiddenAddress = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().serviceAddress.findUnique({ where: { id: serviceAddressA } })
    );
    expect(hiddenAddress).toBeNull();

    const visibleEquipment = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().customerEquipment.findUnique({ where: { id: equipmentAssetA } })
    );
    expect(visibleEquipment?.serviceAddressId).toBe(serviceAddressA);

    const visibleAgreement = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().serviceAgreement.findUnique({ where: { id: serviceAgreementA } })
    );
    expect(visibleAgreement?.projectId).toBe(projectA);

    const visiblePayment = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().payment.findUnique({ where: { id: paymentA } })
    );
    expect(visiblePayment?.invoiceId).toBe(invoiceForPaymentA);

    const hiddenPayment = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().payment.findUnique({ where: { id: paymentA } })
    );
    expect(hiddenPayment).toBeNull();

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().serviceAddress.create({
          data: {
            orgId: orgA,
            customerId: customerA,
            addressLine1: "Viewer blocked",
            city: "Indianapolis",
            state: "IN",
            postalCode: "46201",
          },
        })
      )
    ).rejects.toThrow();

    await expect(
      inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().payment.create({
          data: {
            orgId: orgB,
            invoiceId: invoiceForPaymentA,
            amount: 10,
            paymentDate: new Date(),
            method: "cash",
          },
        })
      )
    ).rejects.toThrow();
  });

  it("enforces core service tenant boundaries before foreign reads or writes", async () => {
    const visibleCustomer = await inSession(adminUser, orgA, "admin", async () => new CrmService().getCustomer(orgA, customerA));
    expect(visibleCustomer.id).toBe(customerA);

    const visibleEstimate = await inSession(adminUser, orgA, "admin", async () => new EstimateEngineService().getById(estimateA, orgA));
    expect(visibleEstimate.id).toBe(estimateA);

    const visibleInvoice = await inSession(adminUser, orgA, "admin", async () => new InvoicesService().getById(invoiceForPaymentA, orgA));
    expect(visibleInvoice.id).toBe(invoiceForPaymentA);

    const visibleJob = await inSession(adminUser, orgA, "admin", async () =>
      new JobsService().getById(orgA, jobA, { userId: adminUser, role: "admin" })
    );
    expect(visibleJob.id).toBe(jobA);

    await expect(
      inSession(otherUser, orgB, "owner", async () => new CrmService().getCustomer(orgB, customerA))
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      inSession(otherUser, orgB, "owner", async () => new EstimateEngineService().getById(estimateA, orgB))
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      inSession(otherUser, orgB, "owner", async () =>
        new EstimateEngineService().updateEstimate({ estimateId: estimateA, orgId: orgB, taxPct: 9 })
      )
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      inSession(otherUser, orgB, "owner", async () => new InvoicesService().getById(invoiceForPaymentA, orgB))
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      inSession(otherUser, orgB, "owner", async () =>
        new JobsService().getById(orgB, jobA, { userId: otherUser, role: "owner" })
      )
    ).rejects.toMatchObject({ statusCode: 404 });

    const unchangedEstimate = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().estimate.findUnique({ where: { id: estimateA }, select: { taxPct: true } })
    );
    expect(Number(unchangedEstimate?.taxPct ?? 0)).toBe(0);
  });

  it("enforces intelligence foundation tenant boundaries", async () => {
    const visibleActivity = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().activityEvent.findUnique({ where: { id: activityEventA } })
    );
    expect(visibleActivity?.orgId).toBe(orgA);

    const hiddenNotification = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().notification.findUnique({ where: { id: notificationA } })
    );
    expect(hiddenNotification).toBeNull();

    const visibleAttachment = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().attachment.findUnique({ where: { id: attachmentA } })
    );
    expect(visibleAttachment?.entityId).toBe(projectA);

    const visibleComment = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().comment.findUnique({ where: { id: commentA } })
    );
    expect(visibleComment?.body).toContain("permit");

    const visibleTagAssignment = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().tagAssignment.findUnique({ where: { id: tagAssignmentA } })
    );
    expect(visibleTagAssignment?.tagId).toBe(tagA);

    const visibleSavedView = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().savedView.findUnique({ where: { id: savedViewA } })
    );
    expect(visibleSavedView?.entityType).toBe("project");

    const visibleRecentItem = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().recentItem.findUnique({ where: { id: recentItemA } })
    );
    expect(visibleRecentItem?.userId).toBe(adminUser);

    const visibleFeatureFlag = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().featureFlag.findUnique({ where: { id: featureFlagA } })
    );
    expect(visibleFeatureFlag?.enabled).toBe(true);

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().featureFlag.create({
          data: {
            orgId: orgA,
            key: "viewer-blocked-flag",
            enabled: true,
            scopeType: "org",
            scopeKey: orgA,
          },
        })
      )
    ).rejects.toThrow();
  });

  it("rejects cross-organization writes", async () => {
    await expect(
      inSession(adminUser, orgA, "admin", async () => {
        return currentTransaction().division.create({
          data: { orgId: orgB, code: "BLOCKED", name: "Cross-org write" },
        });
      })
    ).rejects.toThrow();
  });

  it("rejects viewer writes", async () => {
    await expect(
      inSession(viewerUser, orgA, "viewer", async () => {
        return currentTransaction().division.create({
          data: { orgId: orgA, code: "VIEWER", name: "Viewer write" },
        });
      })
    ).rejects.toThrow();
  });

  it("allows admins to inspect membership history", async () => {
    const rows = await inSession(adminUser, orgA, "admin", async () => {
      return currentTransaction().organizationMembershipAudit.findMany({
        where: { membershipId: viewerMembership },
      });
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orgId: orgA, action: "created", actorRole: "admin" });
  });

  it("derives tenant context only from verified active memberships", async () => {
    const auth = await resolveAuthContext({ sub: "rls-admin", orgId: orgA });

    expect(auth).toMatchObject({
      userId: adminUser,
      orgId: orgA,
      role: "admin",
      canonicalRole: "admin",
      email: "rls-admin@example.com",
    });

    await expect(resolveAuthContext({ sub: "rls-admin", orgId: orgB })).rejects.toThrow(
      "Authenticated user does not belong to the requested organization"
    );

    await expect(resolveAuthContext({ sub: "rls-no-membership", orgId: orgA })).rejects.toThrow(
      "Authenticated user does not belong to the requested organization"
    );
    await expect(resolveAuthContext({ sub: "rls-disabled-membership", orgId: orgA })).rejects.toThrow(
      "Authenticated user does not belong to the requested organization"
    );
  });

  it("proves direct portal resource isolation under forced RLS", async () => {
    const sameOrgProject = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().project.findUnique({ where: { id: projectA } })
    );
    expect(sameOrgProject?.id).toBe(projectA);

    const crossOrgProject = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().project.findUnique({ where: { id: projectA } })
    );
    expect(crossOrgProject).toBeNull();

    const tables = await adminClient.$queryRaw<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>(
      Prisma.sql`
        select c.relname, c.relrowsecurity, c.relforcerowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('projects', 'proposals', 'invoices', 'contracts')
      `
    );
    expect(tables).toHaveLength(4);
    expect(tables.every((table) => table.relrowsecurity && table.relforcerowsecurity)).toBe(true);
  });

  it("provisions a new organization and initial owner atomically", async () => {
    const result = await new OrganizationProvisioningService().provision({
      organizationName: "Provisioned Org",
      regionCode: "US-IN-INDIANAPOLIS",
      owner: {
        authSubject: "provisioned-owner",
        email: "PROVISIONED-OWNER@example.com",
        fullName: "Provisioned Owner",
      },
    });

    expect(result.organization.name).toBe("Provisioned Org");
    expect(result.owner).toMatchObject({ email: "provisioned-owner@example.com", role: "owner", status: "active" });
    expect(await adminClient.organizationMembership.count({ where: { orgId: result.organization.id } })).toBe(1);
    expect(await adminClient.organizationMembershipAudit.count({ where: { orgId: result.organization.id } })).toBe(1);

    const visibleOrganization = await inSession(result.owner.userId, result.organization.id, "owner", async () => {
      return currentTransaction().organization.findUnique({ where: { id: result.organization.id } });
    });
    expect(visibleOrganization?.name).toBe("Provisioned Org");
  });

  it("bootstrapSupabaseIdentity finds an already-provisioned identity's real membership against live RLS, not a false 409", async () => {
    // Regression test for a real production incident: bootstrapSupabaseIdentity's
    // "does this identity already have an organization" lookup used a single
    // basePrisma query with a nested `include` and never set the
    // app.login_lookup / app.user_id / app.org_id session flags these tables'
    // RLS policies require (see memberships_login_lookup_policy and
    // organizations_select_policy) — so the membership/organization rows were
    // silently invisible to it even though they existed, and every
    // already-provisioned identity's second-and-later login falsely got
    // "User exists but has no active organization membership". A mocked
    // Prisma client (the unit tests in auth.service.test.ts) cannot catch an
    // RLS visibility gap; only this Docker-backed live-Postgres suite can.
    const provisioned = await new OrganizationProvisioningService().provision({
      organizationName: "Repeat Login Org",
      owner: {
        authSubject: "repeat-login-owner",
        email: "repeat-login-owner@example.com",
        fullName: "Repeat Login Owner",
      },
    });

    const result = await new AuthService().bootstrapSupabaseIdentity({
      authSubject: "repeat-login-owner",
      email: "repeat-login-owner@example.com",
    });

    expect(result.organization).toEqual({ id: provisioned.organization.id, name: "Repeat Login Org" });
    expect(result.role).toBe("owner");
  });

  it("derives background job scope and role from active membership", async () => {
    const rows = await runWithBackgroundDatabaseSession(
      appClient,
      { jobName: "pricing-refresh", orgId: orgA, userId: viewerUser },
      async () => currentTransaction().division.findMany()
    );

    expect(rows.map((row) => row.id)).toEqual([divisionA]);
    await expect(
      runWithBackgroundDatabaseSession(
        appClient,
        { jobName: "pricing-refresh", orgId: orgA, userId: viewerUser },
        async () => currentTransaction().division.create({
          data: { orgId: orgA, code: "JOB", name: "Background viewer write" },
        })
      )
    ).rejects.toThrow();
  });

  it("runs a supplier price sync worker through the background-session helper and enforces queue review permissions", async () => {
    const fetchFeed = jest.fn().mockResolvedValue([{ materialId: materialForSupplierQueue, proposedUnitCost: 175 }]);

    // A viewer-role background identity may run the job but its proposal is
    // blocked at insert time by the supplier_price_updates write policy.
    await expect(
      runSupplierPriceSyncJob(
        { orgId: orgA, userId: viewerUser, supplierId: supplierA },
        new SupplierIntegrationService(fetchFeed)
      )
    ).rejects.toThrow();

    // An estimator can write (enqueue) but cannot administer (approve/reject).
    const syncResult = await runSupplierPriceSyncJob(
      { orgId: orgA, userId: estimatorUser, supplierId: supplierA },
      new SupplierIntegrationService(fetchFeed)
    );
    expect(syncResult).toEqual({ proposed: 1, skipped: 0 });

    const queued = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().supplierPriceUpdate.findFirst({ where: { materialId: materialForSupplierQueue, status: "pending" } })
    );
    expect(queued).toMatchObject({ proposedUnitCost: expect.anything(), status: "pending" });
    if (!queued) throw new Error("expected a queued supplier price update");

    await expect(
      inSession(estimatorUser, orgA, "estimator", async () =>
        new SupplierIntegrationService().approve(queued.id, orgA, { userId: estimatorUser, orgId: orgA, role: "estimator" })
      )
    ).rejects.toThrow();

    const approved = await inSession(adminUser, orgA, "admin", async () =>
      new SupplierIntegrationService().approve(queued.id, orgA, { userId: adminUser, orgId: orgA, role: "admin" })
    );
    expect(approved.status).toBe("approved");

    const material = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().material.findUnique({ where: { id: materialForSupplierQueue } })
    );
    expect(Number(material?.unitCost)).toBe(175);

    const audits = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().materialPriceAudit.findMany({ where: { materialId: materialForSupplierQueue, source: "supplier-feed" } })
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ oldUnitCost: expect.anything(), actorRole: "admin" });
  });

  it("enforces supplier write permissions and protects suppliers with price update history from deletion", async () => {
    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().supplier.create({ data: { orgId: orgA, name: "Viewer-created supplier" } })
      )
    ).rejects.toThrow();

    const created = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().supplier.create({ data: { orgId: orgA, name: "New Co" } })
    );
    expect(created.name).toBe("New Co");

    // supplierA has price update history from the worker test above — the
    // material/supplier foreign keys on supplier_price_updates are ON DELETE
    // RESTRICT, the same protection material_price_audits gives materials.
    await expect(
      inSession(adminUser, orgA, "admin", async () => currentTransaction().supplier.delete({ where: { id: supplierA } }))
    ).rejects.toThrow();

    await inSession(adminUser, orgA, "admin", async () => currentTransaction().supplier.delete({ where: { id: created.id } }));
  });

  it("scopes common assembly templates to the owning organization and enforces viewer write denial", async () => {
    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        new AssembliesDatabaseService().create({
          orgId: orgA,
          code: "TPL-VIEWER",
          name: "Viewer-created template",
          unitOfMeasure: "EA",
          isTemplate: true,
        })
      )
    ).rejects.toThrow();

    const created = await inSession(adminUser, orgA, "admin", async () =>
      new AssembliesDatabaseService().create({
        orgId: orgA,
        code: "TPL-DRIVEWAY",
        name: "Residential Driveway Base Package",
        unitOfMeasure: "CY",
        isTemplate: true,
      })
    );
    expect(created.isTemplate).toBe(true);

    const templatesForOrgA = await inSession(adminUser, orgA, "admin", async () =>
      new AssembliesDatabaseService().listTemplates(orgA)
    );
    expect(templatesForOrgA.map((row) => row.id)).toContain(created.id);

    const templatesForOrgB = await inSession(otherUser, orgB, "owner", async () =>
      new AssembliesDatabaseService().listTemplates(orgB)
    );
    expect(templatesForOrgB.map((row) => row.id)).not.toContain(created.id);
  });

  it("persists price changes for admins while hiding audit history from viewers", async () => {
    await inSession(adminUser, orgA, "admin", async () => {
      await new MaterialDatabaseService().update(
        materialA,
        { unitCost: 165 },
        orgA,
        { actor: { userId: adminUser, orgId: orgA, role: "admin" }, source: "manual" }
      );
    });

    const adminRows = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().materialPriceAudit.findMany({ where: { materialId: materialA } })
    );
    const viewerRows = await inSession(viewerUser, orgA, "viewer", async () =>
      currentTransaction().materialPriceAudit.findMany({ where: { materialId: materialA } })
    );

    expect(adminRows).toHaveLength(1);
    expect(adminRows[0]).toMatchObject({ materialName: "Ready Mix Concrete", source: "manual", actorRole: "admin" });
    expect(Number(adminRows[0].oldUnitCost)).toBe(150);
    expect(Number(adminRows[0].newUnitCost)).toBe(165);
    expect(viewerRows).toEqual([]);
  });

  it("enforces project-inherited RLS on proposals, invoices, and contracts end to end", async () => {
    await expect(
      inSession(viewerUser, orgA, "viewer", async () => new ProposalsService().create({ orgId: orgA, estimateId: estimateA }))
    ).rejects.toThrow();

    const proposal = await inSession(adminUser, orgA, "admin", async () =>
      new ProposalsService().create({ orgId: orgA, estimateId: estimateA, termsAndConditions: "Net 30" })
    );
    expect(proposal.status).toBe("draft");

    const sameOrgProposal = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().proposal.findUnique({ where: { id: proposal.id } })
    );
    expect(sameOrgProposal?.id).toBe(proposal.id);

    // Cross-org: a session scoped to orgB must not see a proposal that
    // belongs to an orgA project, even by direct id lookup.
    const crossOrgLookup = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().proposal.findUnique({ where: { id: proposal.id } })
    );
    expect(crossOrgLookup).toBeNull();

    const sent = await inSession(adminUser, orgA, "admin", async () => new ProposalsService().send(proposal.id, orgA));
    expect(sent.status).toBe("sent");
    const accepted = await inSession(adminUser, orgA, "admin", async () => new ProposalsService().accept(proposal.id, orgA));
    expect(accepted.status).toBe("accepted");
    expect(accepted.deliveries.map((delivery) => delivery.eventType)).toEqual(["proposal.accepted", "proposal.sent"]);

    await expect(
      inSession(otherUser, orgB, "owner", async () => new ProposalsService().accept(proposal.id, orgB, otherUser))
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      inSession(adminUser, orgA, "admin", async () => new ProposalsService().accept(proposal.id, orgA, adminUser))
    ).rejects.toMatchObject({ statusCode: 409 });

    const visibleDeliveries = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().proposalDelivery.findMany({
        where: { proposalId: proposal.id },
        orderBy: { occurredAt: "desc" },
      })
    );
    expect(visibleDeliveries.map((delivery) => delivery.eventType)).toEqual(["proposal.accepted", "proposal.sent"]);

    const hiddenDeliveries = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().proposalDelivery.findMany({
        where: { proposalId: proposal.id },
      })
    );
    expect(hiddenDeliveries).toEqual([]);

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        new InvoicesService().create({
          orgId: orgA,
          projectId: projectA,
          lineItems: [{ description: "Deposit", quantity: 1, unitOfMeasure: "EA", unitCost: 1000 }],
        })
      )
    ).rejects.toThrow();

    const invoice = await inSession(adminUser, orgA, "admin", async () =>
      new InvoicesService().create({
        orgId: orgA,
        projectId: projectA,
        actorUserId: adminUser,
        actorRole: "admin",
        proposalId: proposal.id,
        lineItems: [{ description: "Deposit", quantity: 1, unitOfMeasure: "EA", unitCost: 1000 }],
      })
    );
    expect(invoice.amount).toBe(1000);
    const sameOrgInvoice = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().invoice.findUnique({ where: { id: invoice.id } })
    );
    expect(sameOrgInvoice?.id).toBe(invoice.id);
    expect(invoice.deliveries.map((delivery) => delivery.eventType)).toEqual(["invoice.created"]);

    const sentInvoice = await inSession(adminUser, orgA, "admin", async () => new InvoicesService().send(invoice.id, orgA, adminUser, "admin"));
    expect(sentInvoice.status).toBe("sent");
    const paidInvoice = await inSession(adminUser, orgA, "admin", async () => new InvoicesService().markPaid(invoice.id, orgA, adminUser, "admin"));
    expect(paidInvoice.status).toBe("paid");
    expect(paidInvoice.deliveries.map((delivery) => delivery.eventType)).toEqual(["invoice.paid", "invoice.sent", "invoice.created"]);

    const invoiceCrossOrgLookup = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().invoice.findUnique({ where: { id: invoice.id } })
    );
    expect(invoiceCrossOrgLookup).toBeNull();

    const visibleInvoiceDeliveries = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().invoiceDelivery.findMany({
        where: { invoiceId: invoice.id },
        orderBy: { occurredAt: "desc" },
      })
    );
    expect(visibleInvoiceDeliveries.map((delivery) => delivery.eventType)).toEqual(["invoice.paid", "invoice.sent", "invoice.created"]);

    const hiddenInvoiceDeliveries = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().invoiceDelivery.findMany({ where: { invoiceId: invoice.id } })
    );
    expect(hiddenInvoiceDeliveries).toEqual([]);

    await expect(
      inSession(viewerUser, orgA, "viewer", async () => new ContractsService().create({ orgId: orgA, proposalId: proposal.id }))
    ).rejects.toThrow();

    const contract = await inSession(adminUser, orgA, "admin", async () =>
      new ContractsService().create({ orgId: orgA, actorUserId: adminUser, actorRole: "admin", proposalId: proposal.id })
    );
    expect(contract.status).toBe("sent");
    const sameOrgContract = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().contract.findUnique({ where: { id: contract.id } })
    );
    expect(sameOrgContract?.id).toBe(contract.id);
    expect(contract.events.map((event) => event.eventType)).toEqual(["contract.created"]);

    const signed = await inSession(adminUser, orgA, "admin", async () =>
      new ContractsService().sign(contract.id, {
        orgId: orgA,
        actorUserId: adminUser,
        actorRole: "admin",
        signerName: "Jane Doe",
        signerEmail: "jane@example.com",
      })
    );
    expect(signed.status).toBe("signed");
    expect(signed.signerName).toBe("Jane Doe");
    expect(signed.events.map((event) => event.eventType)).toEqual(["contract.signed", "contract.created"]);

    const contractCrossOrgLookup = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().contract.findUnique({ where: { id: contract.id } })
    );
    expect(contractCrossOrgLookup).toBeNull();

    const visibleContractEvents = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().contractEvent.findMany({
        where: { contractId: contract.id },
        orderBy: { occurredAt: "desc" },
      })
    );
    expect(visibleContractEvents.map((event) => event.eventType)).toEqual(["contract.signed", "contract.created"]);

    const hiddenContractEvents = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().contractEvent.findMany({ where: { contractId: contract.id } })
    );
    expect(hiddenContractEvents).toEqual([]);
  });

  it("enforces canonical and legacy proposal statuses at the PostgreSQL boundary", async () => {
    await adminClient.proposal.create({ data: { id: proposalDeclinedStatusA, projectId: projectB, status: "declined" } });
    await adminClient.proposal.create({ data: { id: proposalRejectedStatusA, projectId: projectB, status: "rejected" } });

    await expect(
      adminClient.proposal.create({ data: { id: proposalInvalidStatusA, projectId: projectB, status: "unsupported" } })
    ).rejects.toThrow(/proposals_status_check/);

    await expect(adminClient.proposal.findUnique({ where: { id: proposalDeclinedStatusA }, select: { status: true } })).resolves.toMatchObject({ status: "declined" });
    await expect(adminClient.proposal.findUnique({ where: { id: proposalRejectedStatusA }, select: { status: true } })).resolves.toMatchObject({ status: "rejected" });
  });

  it("scopes the dispatch summary to the requesting org and does not require an elevated role to read", async () => {
    // Baseline before adding this test's own fixtures, since jobA (created in
    // beforeAll) already has a scheduledStart in the past and so already
    // contributes to activeJobs/overdueActionable/needsAttention. Asserting
    // on the DELTA rather than an absolute count keeps this robust to that
    // shared fixture (and to any future fixture additions elsewhere in this
    // file) while still proving real org-scoped isolation.
    const before = await inSession(adminUser, orgA, "admin", async () =>
      new JobsService().getDispatchSummary(orgA, { role: "admin" })
    );

    const dispatchOverdueJobA = "10000000-0000-0000-0000-000000000115";
    const dispatchUnscheduledJobA = "10000000-0000-0000-0000-000000000116";
    const dispatchOverdueJobB = "20000000-0000-0000-0000-000000000117";

    await adminClient.job.createMany({
      data: [
        {
          id: dispatchOverdueJobA,
          orgId: orgA,
          projectId: projectA,
          customerId: customerA,
          serviceAddressId: serviceAddressA,
          jobNumber: "JOB-2026-000002",
          title: "Org A Overdue Unassigned Job",
          jobType: "HVAC Service",
          status: "dispatched",
          priority: "high",
          scheduledStart: new Date("2020-01-01T00:00:00.000Z"),
          scheduledEnd: new Date("2020-01-01T02:00:00.000Z"),
          createdById: adminUser,
        },
        {
          id: dispatchUnscheduledJobA,
          orgId: orgA,
          projectId: projectA,
          customerId: customerA,
          serviceAddressId: serviceAddressA,
          jobNumber: "JOB-2026-000003",
          title: "Org A Unscheduled Job",
          jobType: "HVAC Service",
          status: "unscheduled",
          priority: "medium",
          createdById: adminUser,
        },
        // Mirrors dispatchOverdueJobA exactly (same shape/status/date) but in
        // org B — proves an org-B job can never inflate org A's counts.
        {
          id: dispatchOverdueJobB,
          orgId: orgB,
          projectId: projectB,
          customerId: customerB,
          serviceAddressId: serviceAddressB,
          jobNumber: "JOB-2026-000004",
          title: "Org B Overdue Unassigned Job",
          jobType: "Electrical Service",
          status: "dispatched",
          priority: "high",
          scheduledStart: new Date("2020-01-01T00:00:00.000Z"),
          scheduledEnd: new Date("2020-01-01T02:00:00.000Z"),
          createdById: otherUser,
        },
      ],
    });

    const after = await inSession(adminUser, orgA, "admin", async () =>
      new JobsService().getDispatchSummary(orgA, { role: "admin" })
    );

    // Exactly the two org-A jobs, never the org-B one.
    expect(after.activeJobs - before.activeJobs).toBe(2);
    expect(after.unscheduledJobs - before.unscheduledJobs).toBe(1);
    expect(after.overdueActionable - before.overdueActionable).toBe(1);
    // Both new org-A jobs need attention for different reasons (overdue vs.
    // unscheduled) — this is a real cross-check, at the database level, of
    // the single OR'd count the unit tests already verify the shape of.
    expect(after.needsAttention - before.needsAttention).toBe(2);
    // admin is one of MANAGER_ROLES, so these counts are correctly labeled
    // as organization-wide, not narrowed.
    expect(after.scope).toEqual({ source: "organization", role: "admin" });

    const afterOrgB = await inSession(otherUser, orgB, "owner", async () =>
      new JobsService().getDispatchSummary(orgB, { role: "owner" })
    );
    expect(afterOrgB.activeJobs).toBeGreaterThanOrEqual(1);
    expect(afterOrgB.scope).toEqual({ source: "organization", role: "owner" });

    // JobsService.archive() sets archivedAt independently of status — an
    // archived job can still have a non-terminal status like "dispatched".
    // This mirrors dispatchOverdueJobA exactly (same status, same overdue
    // scheduledStart, same unassigned state) except it is archived, so it
    // must NOT move any of the counts above: archived jobs are excluded from
    // the work-queue list by buildJobWhere's default archivedAt: null filter,
    // and the summary counts must agree with that, not silently include it.
    await adminClient.job.create({
      data: {
        id: "10000000-0000-0000-0000-000000000118",
        orgId: orgA,
        projectId: projectA,
        customerId: customerA,
        serviceAddressId: serviceAddressA,
        jobNumber: "JOB-2026-000005",
        title: "Org A Archived (Non-Terminal Status) Job",
        jobType: "HVAC Service",
        status: "dispatched",
        priority: "high",
        scheduledStart: new Date("2020-01-01T00:00:00.000Z"),
        scheduledEnd: new Date("2020-01-01T02:00:00.000Z"),
        archivedAt: new Date(),
        createdById: adminUser,
      },
    });

    const afterArchived = await inSession(adminUser, orgA, "admin", async () =>
      new JobsService().getDispatchSummary(orgA, { role: "admin" })
    );
    expect(afterArchived.activeJobs).toBe(after.activeJobs);
    expect(afterArchived.overdueActionable).toBe(after.overdueActionable);
    expect(afterArchived.needsAttention).toBe(after.needsAttention);

    // Read-only aggregate: a non-admin, non-dispatcher, unassigned session
    // must not be blocked by an application-level permission check (no
    // ApiError thrown). Note this app's jobs_select_policy RLS (see
    // prisma/migrations/20260714120000_add_job_scheduling_engine) restricts
    // *row visibility* on the jobs table itself to admin/owner/dispatcher or
    // an assignee — a "viewer" role session legitimately sees zero job rows
    // (same as the pre-existing "limits technician job visibility" test
    // above proves for direct job reads), so this asserts the call succeeds
    // and returns a well-formed summary, not that it sees the same counts an
    // admin would.
    const viewerSummary = await inSession(viewerUser, orgA, "viewer", async () =>
      new JobsService().getDispatchSummary(orgA, { role: "viewer" })
    );
    expect(viewerSummary).toMatchObject({
      activeJobs: expect.any(Number),
      unscheduledJobs: expect.any(Number),
      scheduledToday: expect.any(Number),
      overdueActionable: expect.any(Number),
      needsAttention: expect.any(Number),
    });
    expect(viewerSummary.activeJobs).toBe(0);
    // The DTO's scope field is what lets the frontend honestly label these
    // as "assigned only" rather than presenting a role-narrowed 0 as if it
    // were a real organization-wide "zero active jobs" total.
    expect(viewerSummary.scope).toEqual({ source: "assigned_only", role: "viewer" });
  });

  describe("organization work-queue reads (estimates, proposals, invoices)", () => {
    // Fresh fixtures scoped to this describe block only; orgA/orgB/projectA/
    // projectB/customerA/customerB are the outer beforeAll's already-committed
    // rows, reused here rather than re-seeding a parallel org pair.
    const estimateQueueA1 = "10000000-0000-0000-0000-000000000201";
    const estimateQueueA2 = "10000000-0000-0000-0000-000000000202";
    const estimateQueueB1 = "20000000-0000-0000-0000-000000000203";
    const proposalQueueA1 = "10000000-0000-0000-0000-000000000204";
    const proposalQueueA2 = "10000000-0000-0000-0000-000000000205";
    const contractQueueA1 = "10000000-0000-0000-0000-000000000206";
    const proposalQueueB1 = "20000000-0000-0000-0000-000000000207";
    const invoiceQueueA1 = "10000000-0000-0000-0000-000000000208";
    const invoiceQueueA2 = "10000000-0000-0000-0000-000000000209";
    const invoiceQueueA3 = "10000000-0000-0000-0000-000000000210";
    const invoiceQueueA4 = "10000000-0000-0000-0000-000000000211";
    const invoiceQueueB1 = "20000000-0000-0000-0000-000000000212";
    const invoiceQueueA5 = "10000000-0000-0000-0000-000000000216";
    const invoiceConcurrency = "10000000-0000-0000-0000-000000000217";
    const invoiceCrossOrg = "10000000-0000-0000-0000-000000000218";
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    beforeAll(async () => {
      await adminClient.estimate.create({
        data: { id: estimateQueueA1, orgId: orgA, projectId: projectA, version: 10, status: "draft", totalPrice: 500 },
      });
      // Canonical status value "sent" remains distinct from "ready" in queue
      // reads; historical rows are still returned without cross-org leakage.
      await adminClient.estimate.create({
        data: { id: estimateQueueA2, orgId: orgA, projectId: projectA, version: 11, status: "sent", totalPrice: 1000 },
      });
      await adminClient.estimate.create({
        data: { id: estimateQueueB1, orgId: orgB, projectId: projectB, version: 1, status: "draft", totalPrice: 777 },
      });

      await adminClient.proposal.create({
        data: {
          id: proposalQueueA1,
          projectId: projectA,
          estimateId: estimateQueueA1,
          status: "sent",
          sentAt: new Date("2026-07-01T00:00:00.000Z"),
          finalPrice: 750,
        },
      });
      await adminClient.proposal.create({
        data: {
          id: proposalQueueA2,
          projectId: projectA,
          estimateId: estimateQueueA2,
          status: "accepted",
          sentAt: new Date("2026-07-05T00:00:00.000Z"),
          viewedAt: new Date("2026-07-06T00:00:00.000Z"),
          finalPrice: 1000,
        },
      });
      await adminClient.contract.create({
        data: { id: contractQueueA1, projectId: projectA, proposalId: proposalQueueA2, status: "pending_signature", termsText: "Net 30" },
      });
      await adminClient.proposal.create({
        data: { id: proposalQueueB1, projectId: projectB, status: "sent", sentAt: new Date("2026-07-01T00:00:00.000Z") },
      });

      await adminClient.invoice.create({
        data: { id: invoiceQueueA1, projectId: projectA, invoiceNumber: 201, status: "sent", amount: 1000, dueDate: yesterday },
      });
      await adminClient.invoice.create({
        data: { id: invoiceQueueA2, projectId: projectA, invoiceNumber: 202, status: "sent", amount: 1000, dueDate: yesterday },
      });
      await adminClient.payment.create({
        data: {
          id: "10000000-0000-0000-0000-000000000213",
          orgId: orgA,
          invoiceId: invoiceQueueA2,
          amount: 400,
          paymentDate: new Date("2026-07-10T00:00:00.000Z"),
          method: "card",
          status: "recorded",
        },
      });
      // A pending (not yet "recorded") payment must not count toward paidAmount.
      await adminClient.payment.create({
        data: {
          id: "10000000-0000-0000-0000-000000000214",
          orgId: orgA,
          invoiceId: invoiceQueueA2,
          amount: 5000,
          paymentDate: new Date("2026-07-11T00:00:00.000Z"),
          method: "card",
          status: "pending",
        },
      });
      await adminClient.invoice.create({
        data: { id: invoiceQueueA3, projectId: projectA, invoiceNumber: 203, status: "sent", amount: 500, dueDate: yesterday },
      });
      await adminClient.payment.create({
        data: {
          id: "10000000-0000-0000-0000-000000000215",
          orgId: orgA,
          invoiceId: invoiceQueueA3,
          amount: 500,
          paymentDate: new Date("2026-07-10T00:00:00.000Z"),
          method: "card",
          status: "recorded",
        },
      });
      // Raw status "void" (the actual DB-allowed value; see invoices_status_check)
      // — must be excluded from overdue/unpaid/partiallyPaid despite a positive balance.
      await adminClient.invoice.create({
        data: { id: invoiceQueueA4, projectId: projectA, invoiceNumber: 204, status: "void", amount: 1000, dueDate: yesterday },
      });
      // Persisted paid is authoritative for follow-up exclusion even when
      // markPaid() intentionally has no corresponding Payment row.
      await adminClient.invoice.create({
        data: { id: invoiceQueueA5, projectId: projectA, invoiceNumber: 205, status: "paid", amount: 750, dueDate: yesterday },
      });
      await adminClient.invoice.create({
        data: { id: invoiceQueueB1, projectId: projectB, invoiceNumber: 1, status: "sent", amount: 250, dueDate: yesterday },
      });
    });

    it("estimates queue: scopes to the caller's organization and never returns another org's rows", async () => {
      const result = await inSession(adminUser, orgA, "admin", async () => new EstimateEngineService().listOrganizationQueue({ orgId: orgA }));
      const ids = result.items.map((item) => item.id);
      expect(ids).toEqual(expect.arrayContaining([estimateQueueA1, estimateQueueA2]));
      expect(ids).not.toContain(estimateQueueB1);
    });

    it("estimates queue: forced RLS blocks Org B rows even if the service were called with a guessed/mismatched orgId while sessioned as Org A", async () => {
      // The controller always derives orgId from the authenticated session
      // (requireOrgId), never a caller-supplied value, so this scenario is
      // not reachable through the real HTTP surface. This proves the
      // deeper guarantee anyway: even a hypothetical broken/bypassed
      // service-layer check could not leak Org B rows, because forced RLS
      // scopes visibility to the session's own app.org_id, not to whatever
      // orgId a query happens to ask for.
      const result = await inSession(adminUser, orgA, "admin", async () => new EstimateEngineService().listOrganizationQueue({ orgId: orgB }));
      expect(result.items.map((item) => item.id)).not.toContain(estimateQueueB1);
    });

    it("estimates queue: a sent status filter returns sent rows with the canonical response status", async () => {
      const result = await inSession(adminUser, orgA, "admin", async () =>
        new EstimateEngineService().listOrganizationQueue({ orgId: orgA, statuses: ["sent"] })
      );
      expect(result.items.map((item) => item.id)).toEqual([estimateQueueA2]);
      expect(result.items[0].status).toBe("sent");
      expect(result.items[0].projectName).toBe("Org A Project");
      expect(result.items[0].customerName).toBe("Org A Customer");
    });

    it("proposals queue: unsigned means no Contract row exists yet; contractId resolves once one does", async () => {
      const unsigned = await inSession(adminUser, orgA, "admin", async () =>
        new ProposalsService().listOrganizationQueue({ orgId: orgA, unsigned: true })
      );
      expect(unsigned.items.map((item) => item.id)).toEqual([proposalQueueA1]);
      expect(unsigned.items[0].contractId).toBeNull();

      const all = await inSession(adminUser, orgA, "admin", async () => new ProposalsService().listOrganizationQueue({ orgId: orgA }));
      const converted = all.items.find((item) => item.id === proposalQueueA2);
      expect(converted?.contractId).toBe(contractQueueA1);
    });

    it("proposals queue: never returns another organization's proposals", async () => {
      const result = await inSession(adminUser, orgA, "admin", async () => new ProposalsService().listOrganizationQueue({ orgId: orgA }));
      expect(result.items.map((item) => item.id)).not.toContain(proposalQueueB1);
    });

    it("invoices queue: computes paidAmount/balanceDue from real Payment rows (excluding non-recorded payments) with exact decimal amounts", async () => {
      const result = await inSession(adminUser, orgA, "admin", async () => new InvoicesService().listOrganizationQueue({ orgId: orgA }));
      const invoiceA2 = result.items.find((item) => item.id === invoiceQueueA2);
      expect(invoiceA2).toMatchObject({ amount: 1000, paidAmount: 400, balanceDue: 600 });

      const invoiceA3 = result.items.find((item) => item.id === invoiceQueueA3);
      expect(invoiceA3).toMatchObject({ amount: 500, paidAmount: 500, balanceDue: 0 });

      const invoiceA5 = result.items.find((item) => item.id === invoiceQueueA5);
      expect(invoiceA5).toMatchObject({ amount: 750, paidAmount: 0, balanceDue: 0 });
    });

    it("invoices queue: overdue/partiallyPaid/unpaid predicates match the documented semantics, excluding voided invoices", async () => {
      const overdue = await inSession(adminUser, orgA, "admin", async () =>
        new InvoicesService().listOrganizationQueue({ orgId: orgA, overdue: true })
      );
      expect(overdue.items.map((i) => i.id).sort()).toEqual([invoiceQueueA1, invoiceQueueA2].sort());

      const partiallyPaid = await inSession(adminUser, orgA, "admin", async () =>
        new InvoicesService().listOrganizationQueue({ orgId: orgA, partiallyPaid: true })
      );
      expect(partiallyPaid.items.map((i) => i.id)).toEqual([invoiceQueueA2]);

      const unpaid = await inSession(adminUser, orgA, "admin", async () =>
        new InvoicesService().listOrganizationQueue({ orgId: orgA, unpaid: true })
      );
      const unpaidIds = unpaid.items.map((i) => i.id);
      expect(unpaidIds).toEqual(expect.arrayContaining([invoiceQueueA1, invoiceQueueA2]));
      expect(unpaidIds).not.toContain(invoiceQueueA3); // fully paid: balanceDue 0
      expect(unpaidIds).not.toContain(invoiceQueueA4); // voided: excluded despite balance > 0
      expect(unpaidIds).not.toContain(invoiceQueueA5); // persisted paid: authoritative even with no Payment row
    });

    it("invoices queue: never returns another organization's invoices, even unfiltered", async () => {
      const result = await inSession(adminUser, orgA, "admin", async () => new InvoicesService().listOrganizationQueue({ orgId: orgA }));
      expect(result.items.map((item) => item.id)).not.toContain(invoiceQueueB1);
    });

    it("invoice detail: returns recorded payment history for the same org and fails closed across orgs", async () => {
      const invoice = await inSession(adminUser, orgA, "admin", async () => new InvoicesService().getById(invoiceQueueA2, orgA));

      expect(invoice).toMatchObject({ paidAmount: 400, balanceDue: 600 });
      expect(invoice.payments).toHaveLength(1);
      expect(invoice.payments[0]).toMatchObject({ amount: 400, method: "card" });

      await expect(
        inSession(adminUser, orgA, "admin", async () => new InvoicesService().getById(invoiceQueueB1, orgA))
      ).rejects.toMatchObject({ statusCode: 404 });

      // A guessed org argument cannot widen the request-scoped RLS session.
      await expect(
        inSession(adminUser, orgA, "admin", async () => new InvoicesService().getById(invoiceQueueB1, orgB))
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("invoices queue: paginates against real Postgres ordering without duplicating rows across pages", async () => {
      const page1 = await inSession(adminUser, orgA, "admin", async () =>
        new InvoicesService().listOrganizationQueue({ orgId: orgA, limit: 2 })
      );
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await inSession(adminUser, orgA, "admin", async () =>
        new InvoicesService().listOrganizationQueue({ orgId: orgA, limit: 2, cursor: page1.nextCursor! })
      );
      const page1Ids = page1.items.map((i) => i.id);
      const page2Ids = page2.items.map((i) => i.id);
      expect(page1Ids.filter((id) => page2Ids.includes(id))).toHaveLength(0);
    });

    it("invoices queue: an invalid cursor is rejected with a 400 ApiError before any query runs", async () => {
      await expect(
        inSession(adminUser, orgA, "admin", async () => new InvoicesService().listOrganizationQueue({ orgId: orgA, cursor: "not-a-real-cursor" }))
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("serializes concurrent final payments and emits one paid transition while preserving both payments", async () => {
      await adminClient.invoice.create({
        data: { id: invoiceConcurrency, projectId: projectA, invoiceNumber: 206, status: "sent", amount: 100, dueDate: yesterday },
      });

      const [first, second] = await Promise.all([
        inSession(adminUser, orgA, "admin", async () =>
          new CrmService().createPayment(
            orgA,
            invoiceConcurrency,
            { amount: 50, paymentDate: "2026-07-12T00:00:00.000Z", method: "card" },
            adminUser,
            "admin"
          )
        ),
        inSession(adminUser, orgA, "admin", async () =>
          new CrmService().createPayment(
            orgA,
            invoiceConcurrency,
            { amount: 50, paymentDate: "2026-07-13T00:00:00.000Z", method: "cash" },
            adminUser,
            "admin"
          )
        ),
      ]);

      const state = await inSession(adminUser, orgA, "admin", async () => ({
        invoice: await currentTransaction().invoice.findUnique({ where: { id: invoiceConcurrency } }),
        payments: await currentTransaction().payment.findMany({ where: { invoiceId: invoiceConcurrency } }),
        paidEvents: await currentTransaction().invoiceDelivery.findMany({
          where: { invoiceId: invoiceConcurrency, eventType: "invoice.paid" },
        }),
      }));

      expect([first.id, second.id]).toEqual(expect.arrayContaining(state.payments.map((payment) => payment.id)));
      expect(state.payments).toHaveLength(2);
      expect(state.invoice?.status).toBe("paid");
      expect(state.paidEvents).toHaveLength(1);
    });

    it("keeps reconciliation tenant-scoped and never revives a voided invoice", async () => {
      await adminClient.invoice.create({
        data: { id: invoiceCrossOrg, projectId: projectA, invoiceNumber: 207, status: "sent", amount: 100, dueDate: yesterday },
      });

      await expect(
        inSession(otherUser, orgB, "owner", async () =>
          new CrmService().createPayment(
            orgB,
            invoiceCrossOrg,
            { amount: 100, paymentDate: "2026-07-14T00:00:00.000Z", method: "card" },
            otherUser
          )
        )
      ).rejects.toMatchObject({ statusCode: 404 });

      await inSession(adminUser, orgA, "admin", async () =>
        new CrmService().createPayment(
          orgA,
          invoiceQueueA4,
          { amount: 1000, paymentDate: "2026-07-15T00:00:00.000Z", method: "card" },
          adminUser
        )
      );
      const voided = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().invoice.findUnique({ where: { id: invoiceQueueA4 } })
      );
      expect(voided?.status).toBe("void");
    });

    it("serializes competing proposal decisions and records one delivery event", async () => {
      await adminClient.proposal.create({
        data: { id: proposalConcurrencyA, projectId: projectA, status: "sent", sentAt: new Date() },
      });

      const transitionResults = await Promise.allSettled([
        inSession(adminUser, orgA, "admin", async () => new ProposalsService().accept(proposalConcurrencyA, orgA, adminUser)),
        inSession(adminUser, orgA, "admin", async () => new ProposalsService().reject(proposalConcurrencyA, orgA, adminUser)),
      ]);
      expect(transitionResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(transitionResults.filter((result) => result.status === "rejected")).toHaveLength(1);
      const transitionFailure = transitionResults.find((result) => result.status === "rejected");
      expect(transitionFailure).toMatchObject({ reason: { statusCode: 409 } });

      const finalConcurrencyRow = await adminClient.proposal.findUnique({
        where: { id: proposalConcurrencyA },
        select: { status: true },
      });
      expect(["accepted", "declined"]).toContain(finalConcurrencyRow?.status);
      const concurrencyDeliveries = await adminClient.proposalDelivery.findMany({
        where: { proposalId: proposalConcurrencyA },
        select: { eventType: true },
      });
      expect(concurrencyDeliveries).toHaveLength(1);
    });
  });
});

function inSession<T>(userId: string, orgId: string, role: SupportedRole, operation: () => Promise<T>): Promise<T> {
  return runWithDatabaseSession(appClient, { userId, orgId, role }, operation, "integration-test");
}

function inLoginLookupSession<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return appClient.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`select set_config('app.login_lookup', 'true', true)`);
    return operation(transaction);
  });
}

function currentTransaction() {
  const transaction = getRequestDatabaseClient();
  if (!transaction) throw new Error("Expected an active request database transaction");
  return transaction;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for RLS integration tests`);
  return value;
}
