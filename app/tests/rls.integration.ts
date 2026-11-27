import { randomUUID } from "node:crypto";
import { extractPdfText } from "./helpers/extract-pdf-text";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  getRequestDatabaseClient,
  runWithBackgroundDatabaseSession,
  runWithDatabaseSession,
  runWithPortalDatabaseSession,
} from "../db/requestSession";
import { resolveAuthContext } from "../backend/auth/session";
import type { SupportedRole } from "../domain";
import type { AuthContext } from "../backend/auth/context";
import {
  approveCodeSource,
  getCodeSource,
  ingestOfficialCodeSource,
} from "../modules/costbook/codes/ingestion";
import { PrismaCodesSourceStore } from "../modules/costbook/codes/store";
import { OrganizationProvisioningService } from "../modules/organization-provisioning/service";
import { MaterialDatabaseService } from "../modules/material-database/service";
import { SupplierIntegrationService } from "../modules/supplier-integration/service";
import { runSupplierPriceSyncJob } from "../modules/supplier-integration/worker";
import {
  consumeAuthorizationState,
  createAuthorizationState,
} from "../modules/supplier-integration/abcOAuth";
import { AssembliesDatabaseService } from "../modules/assemblies-database/service";
import { ProposalsService } from "../modules/proposals/service";
import { AIEstimateAssistService } from "../modules/ai-estimate-assist/service";
import { EstimateEngineService } from "../modules/estimate-engine/service";
import { InvoicesService } from "../modules/invoices/service";
import { CrmService } from "../modules/crm/service";
import { ContractsService } from "../modules/contracts/service";
import { ProjectTasksService } from "../modules/project-tasks/service";
import { CodesPermitTasksService } from "../modules/costbook/codes/permitTasks.service";
import { JobsService } from "../modules/jobs/service";
import { JobExpensesService } from "../modules/expenses/service";
import { AuthService } from "../modules/auth/service";
import { OrganizationSettingsService } from "../modules/settings/service";
import { FinancialSummaryService } from "../modules/intelligence/financialSummary";

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
const supplierB = "20000000-0000-0000-0000-000000000071";
const materialForSupplierQueue = "10000000-0000-0000-0000-000000000072";
const materialB = "20000000-0000-0000-0000-000000000061";
const supplierProductA = "10000000-0000-0000-0000-000000000073";
const supplierProductB = "20000000-0000-0000-0000-000000000073";
const supplierObservationA = "10000000-0000-0000-0000-000000000074";
const supplierObservationB = "20000000-0000-0000-0000-000000000074";
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
const portalContractA = "10000000-0000-0000-0000-000000000206";

const davisBaconDeterminationA = "rls-davis-bacon-determination-a";
const davisBaconDeterminationB = "rls-davis-bacon-determination-b";
const davisBaconRateA = "rls-davis-bacon-rate-a";
const davisBaconRateB = "rls-davis-bacon-rate-b";

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
    await adminClient.supplier.createMany({
      data: [
        { id: supplierA, orgId: orgA, name: "Acme Building Supply" },
        { id: supplierB, orgId: orgB, name: "Other Org Supply" },
      ],
    });
    await adminClient.material.createMany({
      data: [
        {
          id: materialA,
          orgId: orgA,
          name: "Ready Mix Concrete",
          unitOfMeasure: "CY",
          unitCost: 150,
          wasteFactorPct: 0,
        },
        {
          id: materialB,
          orgId: orgB,
          name: "Other Org Material",
          unitOfMeasure: "EA",
          unitCost: 50,
          wasteFactorPct: 0,
        },
      ],
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
    await adminClient.supplierProduct.createMany({
      data: [
        {
          id: supplierProductA,
          orgId: orgA,
          supplierId: supplierA,
          materialId: materialA,
          supplierProductKey: "RLS-SKU-A",
          name: "Org A supplier product",
        },
        {
          id: supplierProductB,
          orgId: orgB,
          supplierId: supplierB,
          materialId: materialB,
          supplierProductKey: "RLS-SKU-B",
          name: "Org B supplier product",
        },
      ],
    });
    await adminClient.supplierPriceObservation.createMany({
      data: [
        {
          id: supplierObservationA,
          orgId: orgA,
          supplierProductId: supplierProductA,
          observationKey: "shared-observation-key",
          observedAt: new Date("2026-09-19T12:00:00.000Z"),
          priceStatus: "priced",
          effectivePrice: 100,
        },
        {
          id: supplierObservationB,
          orgId: orgB,
          supplierProductId: supplierProductB,
          observationKey: "shared-observation-key",
          observedAt: new Date("2026-09-19T12:00:00.000Z"),
          priceStatus: "priced",
          effectivePrice: 200,
        },
      ],
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
        status: "ready",
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
    await adminClient.davisBaconDetermination.createMany({
      data: [
        {
          id: davisBaconDeterminationA,
          orgId: orgA,
          wdNumber: "IN20260050",
          revisionNumber: 1,
          state: "IN",
          counties: ["Vigo"],
          constructionTypes: ["Residential"],
        },
        {
          id: davisBaconDeterminationB,
          orgId: orgB,
          wdNumber: "IN20260003",
          revisionNumber: 2,
          state: "IN",
          counties: ["Vigo"],
          constructionTypes: ["Building"],
        },
      ],
    });
    await adminClient.davisBaconRate.createMany({
      data: [
        {
          id: davisBaconRateA,
          orgId: orgA,
          determinationId: davisBaconDeterminationA,
          wdNumber: "IN20260050",
          revisionNumber: 1,
          rateIdentifier: "TEST-A",
          occupation: "CARPENTER",
          baseRate: 25,
        },
        {
          id: davisBaconRateB,
          orgId: orgB,
          determinationId: davisBaconDeterminationB,
          wdNumber: "IN20260003",
          revisionNumber: 2,
          rateIdentifier: "TEST-B",
          occupation: "ELECTRICIAN",
          baseRate: 30,
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

  it("enforces Davis-Bacon determination and rate tenant boundaries", async () => {
    const visibleDeterminations = await inSession(viewerUser, orgA, "viewer", async () =>
      currentTransaction().davisBaconDetermination.findMany({ orderBy: { id: "asc" } })
    );
    expect(visibleDeterminations.map((row) => row.id)).toEqual([davisBaconDeterminationA]);

    const visibleRates = await inSession(viewerUser, orgA, "viewer", async () =>
      currentTransaction().davisBaconRate.findMany({ orderBy: { id: "asc" } })
    );
    expect(visibleRates.map((row) => row.id)).toEqual([davisBaconRateA]);

    await expect(
      inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().davisBaconDetermination.create({
          data: {
            id: "rls-davis-bacon-cross-org",
            orgId: orgB,
            wdNumber: "IN20990001",
            revisionNumber: 1,
            state: "IN",
            counties: ["Vigo"],
            constructionTypes: ["Building"],
          },
        })
      )
    ).rejects.toThrow();

    // A writable tenant may not reference a different tenant's WD. PostgreSQL
    // FK checks bypass RLS, so this must be enforced by the composite FK.
    await expect(
      inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().davisBaconRate.create({
          data: {
            id: "rls-davis-bacon-cross-parent",
            orgId: orgA,
            determinationId: davisBaconDeterminationB,
            wdNumber: "IN20260003",
            revisionNumber: 2,
            rateIdentifier: "TEST-CROSS-ORG",
            occupation: "LABORER",
            baseRate: 20,
          },
        })
      )
    ).rejects.toThrow();

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().davisBaconRate.create({
          data: {
            id: "rls-davis-bacon-viewer-write",
            orgId: orgA,
            determinationId: davisBaconDeterminationA,
            wdNumber: "IN20260050",
            revisionNumber: 1,
            rateIdentifier: "TEST-VIEWER",
            occupation: "LABORER",
            baseRate: 20,
          },
        })
      )
    ).rejects.toThrow();
  });

  it("enforces regional supplier evidence tenant and manager boundaries", async () => {
    const visibleProducts = await inSession(viewerUser, orgA, "viewer", async () =>
      currentTransaction().supplierProduct.findMany({ orderBy: { id: "asc" } })
    );
    expect(visibleProducts.map((row) => row.id)).toContain(supplierProductA);
    expect(visibleProducts.map((row) => row.id)).not.toContain(supplierProductB);

    const visibleObservations = await inSession(viewerUser, orgA, "viewer", async () =>
      currentTransaction().supplierPriceObservation.findMany({ orderBy: { id: "asc" } })
    );
    expect(visibleObservations.map((row) => row.id)).toContain(supplierObservationA);
    expect(visibleObservations.map((row) => row.id)).not.toContain(supplierObservationB);

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().supplierProduct.create({
          data: {
            orgId: orgA,
            supplierId: supplierA,
            materialId: materialA,
            supplierProductKey: "RLS-VIEWER-PRODUCT",
            name: "Viewer-created supplier product",
          },
        })
      )
    ).rejects.toThrow();

    await expect(
      inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().supplierPriceObservation.create({
          data: {
            orgId: orgA,
            supplierProductId: supplierProductA,
            observationKey: "rls-viewer-observation",
            observedAt: new Date("2026-09-19T13:00:00.000Z"),
            priceStatus: "unavailable",
          },
        })
      )
    ).rejects.toThrow();

    const managerProduct = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().supplierProduct.create({
        data: {
          orgId: orgA,
          supplierId: supplierA,
          materialId: materialA,
          supplierProductKey: "RLS-MANAGER-PRODUCT",
          name: "Manager-created supplier product",
        },
      })
    );
    const managerObservation = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().supplierPriceObservation.create({
        data: {
          orgId: orgA,
          supplierProductId: managerProduct.id,
          observationKey: "rls-manager-observation",
          observedAt: new Date("2026-09-19T14:00:00.000Z"),
          priceStatus: "unavailable",
        },
      })
    );
    expect(managerObservation.orgId).toBe(orgA);

    await expect(
      inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().supplierProduct.create({
          data: {
            orgId: orgB,
            supplierId: supplierB,
            materialId: materialB,
            supplierProductKey: "RLS-CROSS-ORG-PRODUCT",
            name: "Cross-org write attempt",
          },
        })
      )
    ).rejects.toThrow();

    await expect(
      adminClient.supplierProduct.create({
        data: {
          orgId: orgA,
          supplierId: supplierA,
          materialId: materialB,
          supplierProductKey: "RLS-CROSS-MATERIAL",
          name: "Cross-tenant material link",
        },
      })
    ).rejects.toThrow();
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

  it("scopes shared field tasks to active assignments under forced RLS", async () => {
    const unassignedId = randomUUID();
    const taskIds = Array.from({ length: 4 }, () => randomUUID());
    await adminClient.job.create({ data: { id: unassignedId, orgId: orgA, projectId: projectA, customerId: customerA, serviceAddressId: serviceAddressA, jobNumber: `TASK-${unassignedId}`, title: "Unassigned task job", description: "Isolation fixture", jobType: "Service", status: "scheduled", priority: "medium", createdById: adminUser } });
    await adminClient.projectTask.createMany({ data: [
      { id: taskIds[0], projectId: projectA, jobId: jobA, title: "Shared assigned-job task", assignedTo: "Someone else", status: "blocked", priority: "high" },
      { id: taskIds[1], projectId: projectA, jobId: unassignedId, title: "Same org unassigned", status: "todo", priority: "medium" },
      { id: taskIds[2], projectId: projectB, jobId: jobB, title: "Other tenant task", status: "todo", priority: "medium" },
      { id: taskIds[3], projectId: projectA, jobId: jobA, title: "Completed task", status: "completed", priority: "medium" },
    ] });
    const load = (userId: string, orgId: string, role: SupportedRole) => inSession(userId, orgId, role, () => new ProjectTasksService().listByAssignedJobs({ orgId, userId }));
    try {
      const visible = await load(technicianUser, orgA, "technician");
      expect(visible.map((task) => task.id)).toEqual([taskIds[0]]);
      expect(visible[0].jobId).toBe(jobA);
      expect(await load(viewerUser, orgA, "viewer")).toEqual([]);
      expect(await load(otherUser, orgB, "owner")).toEqual([]);
      // Even a mistaken service scope cannot defeat the session's tenant RLS.
      expect(await inSession(otherUser, orgB, "owner", () => new ProjectTasksService().listByAssignedJobs({ orgId: orgA, userId: technicianUser }))).toEqual([]);
      for (const data of [{ removedAt: new Date(), declinedAt: null }, { removedAt: null, declinedAt: new Date() }]) {
        await adminClient.jobAssignment.update({ where: { id: technicianAssignmentA }, data });
        expect(await load(technicianUser, orgA, "technician")).toEqual([]);
      }
    } finally {
      await adminClient.jobAssignment.update({ where: { id: technicianAssignmentA }, data: { removedAt: null, declinedAt: null } });
      await adminClient.projectTask.deleteMany({ where: { id: { in: taskIds } } });
      await adminClient.job.delete({ where: { id: unassignedId } });
    }
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

  it("enforces codes permit task and fee review isolation, role gates, and fee no-op", async () => {
    const taskId = randomUUID();
    const otherTaskId = randomUUID();
    const feeId = randomUUID();
    const before = await adminClient.estimate.findUniqueOrThrow({
      where: { id: estimateA },
      select: { subtotalCost: true, totalPrice: true },
    });
    await adminClient.codesPermitTask.createMany({
      data: [
        { id: taskId, orgId: orgA, projectId: projectA, taskKind: "permit", title: "File county sign permit", permitStatus: "not_submitted", assigneeId: technicianUser },
        { id: otherTaskId, orgId: orgA, projectId: projectA, taskKind: "inspection", title: "Unassigned inspection", permitStatus: "not_submitted" },
      ],
    });
    await adminClient.codesFeeReview.create({
      data: { id: feeId, orgId: orgA, projectId: projectA, estimateId: estimateA, feeCents: 12500, feeSource: "quoted", currency: "USD", status: "pending" },
    });
    try {
      // Own-org reads see the rows; the other tenant sees nothing.
      const visible = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesPermitTask.findUnique({ where: { id: taskId } }),
      );
      expect(visible?.id).toBe(taskId);
      const hiddenTask = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().codesPermitTask.findUnique({ where: { id: taskId } }),
      );
      expect(hiddenTask).toBeNull();
      const hiddenFee = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().codesFeeReview.findUnique({ where: { id: feeId } }),
      );
      expect(hiddenFee).toBeNull();

      // Cross-org writes are refused by RLS even with a matching org_id claim.
      await expect(
        inSession(otherUser, orgB, "owner", async () =>
          currentTransaction().codesPermitTask.create({
            data: { orgId: orgA, projectId: projectA, taskKind: "permit", title: "Cross-org task", permitStatus: "not_submitted" },
          }),
        ),
      ).rejects.toThrow();

      // Role narrowing is the service's job: a technician lists only tasks
      // assigned to them, even though RLS select is org-scoped.
      const techTasks = await inSession(technicianUser, orgA, "technician", async () =>
        new CodesPermitTasksService(currentTransaction() as unknown as typeof appClient).list(orgA, "technician", technicianUser, projectA),
      );
      expect(techTasks.map((row) => row.id)).toEqual([taskId]);

      // The assigned technician may update their own task's explicit status.
      const techUpdated = await inSession(technicianUser, orgA, "technician", async () =>
        currentTransaction().codesPermitTask.update({ where: { id: taskId }, data: { permitStatus: "inspection_scheduled" } }),
      );
      expect(techUpdated.permitStatus).toBe("inspection_scheduled");
      // …but not a task assigned to someone else (or no one).
      await expect(
        inSession(technicianUser, orgA, "technician", async () =>
          currentTransaction().codesPermitTask.update({ where: { id: otherTaskId }, data: { permitStatus: "approved" } }),
        ),
      ).rejects.toThrow();
      // Viewers may not create permit tasks.
      await expect(
        inSession(viewerUser, orgA, "viewer", async () =>
          currentTransaction().codesPermitTask.create({
            data: { orgId: orgA, projectId: projectA, taskKind: "permit", title: "Viewer task", permitStatus: "not_submitted" },
          }),
        ),
      ).rejects.toThrow();

      // Fee-review writes are owner/admin only.
      await expect(
        inSession(technicianUser, orgA, "technician", async () =>
          currentTransaction().codesFeeReview.update({ where: { id: feeId }, data: { status: "approved" } }),
        ),
      ).rejects.toThrow();
      const approved = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesFeeReview.update({
          where: { id: feeId },
          data: { status: "approved", reviewedBy: adminUser, reviewedAt: new Date() },
        }),
      );
      expect(approved.status).toBe("approved");

      // Financial no-op: approving the fee changed no estimate total.
      const after = await adminClient.estimate.findUniqueOrThrow({
        where: { id: estimateA },
        select: { subtotalCost: true, totalPrice: true },
      });
      expect(after.subtotalCost.toString()).toBe(before.subtotalCost.toString());
      expect(after.totalPrice.toString()).toBe(before.totalPrice.toString());
    } finally {
      await adminClient.codesFeeReview.deleteMany({ where: { id: feeId } });
      await adminClient.codesPermitTask.deleteMany({ where: { id: { in: [taskId, otherTaskId] } } });
    }
  });

  it("rejects dispatcher writes, dispatcher-as-assignee updates, and cross-org parent references on permit tasks and fee reviews", async () => {
    const dispatcherUser = randomUUID();
    const dispatcherMembership = randomUUID();
    const assessmentA = randomUUID();
    const assessmentB = randomUUID();
    const dispatcherTaskId = randomUUID();
    const plainTaskId = randomUUID();
    const feeId = randomUUID();
    await adminClient.appUser.create({
      data: { id: dispatcherUser, authSubject: "rls-dispatcher", email: "rls-dispatcher@example.com" },
    });
    await adminClient.organizationMembership.create({
      data: { id: dispatcherMembership, orgId: orgA, userId: dispatcherUser, role: "dispatcher", status: "active" },
    });
    await adminClient.codesJobAssessment.createMany({
      data: [
        { id: assessmentA, orgId: orgA, projectId: projectA, estimateId: estimateA, workType: "sign replacement", status: "needs_review", citations: [], unknowns: [], createdBy: adminUser },
        { id: assessmentB, orgId: orgB, projectId: projectB, workType: "sign replacement", status: "needs_review", citations: [], unknowns: [], createdBy: otherUser },
      ],
    });
    await adminClient.codesPermitTask.createMany({
      data: [
        { id: dispatcherTaskId, orgId: orgA, projectId: projectA, taskKind: "permit", title: "Dispatcher-assigned task", permitStatus: "not_submitted", assigneeId: dispatcherUser },
        { id: plainTaskId, orgId: orgA, projectId: projectA, taskKind: "inspection", title: "Plain inspection task", permitStatus: "not_submitted" },
      ],
    });
    await adminClient.codesFeeReview.create({
      data: { id: feeId, orgId: orgA, projectId: projectA, estimateId: estimateA, feeCents: 1000, feeSource: "quoted", currency: "USD", status: "pending" },
    });
    try {
      // Dispatcher writes are rejected on both tables: the admin branches
      // require owner/admin explicitly, not current_app_can_administer().
      await expect(
        inSession(dispatcherUser, orgA, "dispatcher", async () =>
          currentTransaction().codesPermitTask.create({
            data: { orgId: orgA, projectId: projectA, taskKind: "permit", title: "Dispatcher task", permitStatus: "not_submitted" },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        inSession(dispatcherUser, orgA, "dispatcher", async () =>
          currentTransaction().codesPermitTask.delete({ where: { id: plainTaskId } }),
        ),
      ).rejects.toThrow();
      await expect(
        inSession(dispatcherUser, orgA, "dispatcher", async () =>
          currentTransaction().codesFeeReview.create({
            data: { orgId: orgA, projectId: projectA, feeCents: 1000, feeSource: "quoted", currency: "USD", status: "pending" },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        inSession(dispatcherUser, orgA, "dispatcher", async () =>
          currentTransaction().codesFeeReview.update({ where: { id: feeId }, data: { status: "approved" } }),
        ),
      ).rejects.toThrow();

      // A dispatcher assigned to a task still cannot update it: the
      // assignee exception requires the technician role as well as the
      // matching assignee id.
      await expect(
        inSession(dispatcherUser, orgA, "dispatcher", async () =>
          currentTransaction().codesPermitTask.update({ where: { id: dispatcherTaskId }, data: { permitStatus: "under_review" } }),
        ),
      ).rejects.toThrow();
      const untouched = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesPermitTask.findUnique({ where: { id: dispatcherTaskId } }),
      );
      expect(untouched?.permitStatus).toBe("not_submitted");

      // Cross-org parent references are refused even with a matching
      // org_id claim: project, assessment, and (for fee reviews) estimate.
      await expect(
        inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().codesPermitTask.create({
            data: { orgId: orgA, projectId: projectB, taskKind: "permit", title: "Cross-org project task", permitStatus: "not_submitted" },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().codesPermitTask.create({
            data: { orgId: orgA, projectId: projectA, assessmentId: assessmentB, taskKind: "permit", title: "Cross-org assessment task", permitStatus: "not_submitted" },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().codesFeeReview.create({
            data: { orgId: orgA, projectId: projectB, feeCents: 1000, feeSource: "quoted", currency: "USD", status: "pending" },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().codesFeeReview.create({
            data: { orgId: orgA, projectId: projectA, assessmentId: assessmentB, feeCents: 1000, feeSource: "quoted", currency: "USD", status: "pending" },
          }),
        ),
      ).rejects.toThrow();

      // Valid same-org associations still work for owner/admin.
      const sameOrgTask = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesPermitTask.create({
          data: { orgId: orgA, projectId: projectA, assessmentId: assessmentA, assigneeId: technicianUser, taskKind: "permit", title: "Same-org task", permitStatus: "not_submitted" },
        }),
      );
      expect(sameOrgTask.assessmentId).toBe(assessmentA);
      const sameOrgFee = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesFeeReview.create({
          data: { orgId: orgA, projectId: projectA, estimateId: estimateA, assessmentId: assessmentA, feeCents: 1000, feeSource: "quoted", currency: "USD", status: "pending" },
        }),
      );
      expect(sameOrgFee.assessmentId).toBe(assessmentA);
      await adminClient.codesFeeReview.delete({ where: { id: sameOrgFee.id } });
      await adminClient.codesPermitTask.delete({ where: { id: sameOrgTask.id } });
    } finally {
      await adminClient.codesFeeReview.deleteMany({ where: { id: feeId } });
      await adminClient.codesPermitTask.deleteMany({ where: { id: { in: [dispatcherTaskId, plainTaskId] } } });
      await adminClient.codesJobAssessment.deleteMany({ where: { id: { in: [assessmentA, assessmentB] } } });
      await adminClient.organizationMembership.deleteMany({ where: { id: dispatcherMembership } });
      await adminClient.appUser.deleteMany({ where: { id: dispatcherUser } });
    }
  });

  it("serializes concurrent task revisions without losing a saved update or tenant isolation", async () => {
    const task = await adminClient.projectTask.create({ data: { projectId: projectA, title: "Guarded concurrent task", status: "todo", priority: "high" } });
    const revision = task.updatedAt;
    const save = (status: "blocked" | "completed") => inSession(adminUser, orgA, "admin", async () =>
      new ProjectTasksService(currentTransaction() as unknown as typeof appClient).update(task.id, { orgId: orgA, status, expectedUpdatedAt: revision })
    );
    try {
      const results = await Promise.allSettled([save("blocked"), save("completed")]);
      const successes = results.filter((result) => result.status === "fulfilled");
      const failures = results.filter((result) => result.status === "rejected");
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      if (failures[0].status === "rejected") expect(failures[0].reason).toMatchObject({ statusCode: 409 });
      const persisted = await adminClient.projectTask.findUniqueOrThrow({ where: { id: task.id } });
      if (successes[0].status === "fulfilled") expect(persisted.status).toBe(successes[0].value.status);
      expect(persisted.title).toBe(task.title);
      expect(persisted.updatedAt.getTime()).toBeGreaterThan(revision.getTime());
      await expect(save("completed")).rejects.toMatchObject({ statusCode: 409 });
      await expect(inSession(otherUser, orgB, "owner", async () =>
        new ProjectTasksService(currentTransaction() as unknown as typeof appClient).update(task.id, { orgId: orgB, status: "completed", expectedUpdatedAt: persisted.updatedAt })
      )).rejects.toMatchObject({ statusCode: 404 });
      await expect(inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().projectTask.update({ where: { id: task.id, updatedAt: persisted.updatedAt }, data: { status: "todo" } })
      )).rejects.toThrow();
    } finally { await adminClient.projectTask.delete({ where: { id: task.id } }); }
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

  it("scopes job expenses through the job join at the database boundary", async () => {
    // jobA belongs to orgA with technicianUser assigned; jobB belongs to orgB.
    const expenseA = randomUUID();
    const expenseB = randomUUID();
    try {
      await adminClient.jobExpense.createMany({
        data: [
          { id: expenseA, orgId: orgA, jobId: jobA, amountCents: 1999, category: "material", vendor: "Org A vendor", receiptNote: "", incurredOn: new Date("2026-11-01T00:00:00.000Z"), createdById: adminUser },
          { id: expenseB, orgId: orgB, jobId: jobB, amountCents: 5000, category: "labor", vendor: "Org B vendor", receiptNote: "", incurredOn: new Date("2026-11-01T00:00:00.000Z"), createdById: otherUser },
        ],
      });

      // Append-only audit records must inherit the exact job/organization scope.
      const eventA = randomUUID();
      const eventB = randomUUID();
      await adminClient.jobExpenseEvent.createMany({
        data: [
          { id: eventA, orgId: orgA, jobId: jobA, expenseId: expenseA,
            actorUserId: adminUser, eventType: "created", payloadJson: {} },
          { id: eventB, orgId: orgB, jobId: jobB, expenseId: expenseB,
            actorUserId: otherUser, eventType: "created", payloadJson: {} },
        ],
      });
      const adminEvents = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().jobExpenseEvent.findMany()
      );
      expect(adminEvents.map((event) => event.id)).toContain(eventA);
      expect(adminEvents.some((event) => event.id === eventB)).toBe(false);
      const assignedEvents = await inSession(technicianUser, orgA, "technician", async () =>
        currentTransaction().jobExpenseEvent.findMany({ where: { expenseId: expenseA } })
      );
      expect(assignedEvents.map((event) => event.id)).toEqual([eventA]);
      const foreignEvent = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().jobExpenseEvent.findUnique({ where: { id: eventA } })
      );
      expect(foreignEvent).toBeNull();
      const unassignedEvent = await inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().jobExpenseEvent.findUnique({ where: { id: eventA } })
      );
      expect(unassignedEvent).toBeNull();

      const adminVisible = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().jobExpense.findMany({ orderBy: { createdAt: "asc" } })
      );
      expect(adminVisible.map((row) => row.id)).toEqual([expenseA]);

      const technicianVisible = await inSession(technicianUser, orgA, "technician", async () =>
        currentTransaction().jobExpense.findMany()
      );
      expect(technicianVisible.map((row) => row.id)).toEqual([expenseA]);

      const otherOrgHidden = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().jobExpense.findUnique({ where: { id: expenseA } })
      );
      expect(otherOrgHidden).toBeNull();

      const unassignedHidden = await inSession(viewerUser, orgA, "viewer", async () =>
        currentTransaction().jobExpense.findUnique({ where: { id: expenseA } })
      );
      expect(unassignedHidden).toBeNull();

      await expect(
        inSession(technicianUser, orgA, "technician", async () =>
          currentTransaction().jobExpense.create({
            data: { id: randomUUID(), orgId: orgA, jobId: jobB, amountCents: 100, category: "other", vendor: "", receiptNote: "", incurredOn: new Date("2026-11-01T00:00:00.000Z"), createdById: technicianUser },
          })
        ),
      ).rejects.toThrow();
    } finally {
      await adminClient.jobExpenseEvent.deleteMany({ where: { expenseId: { in: [expenseA, expenseB] } } });
      await adminClient.jobExpense.deleteMany({ where: { id: { in: [expenseA, expenseB] } } });
    }
  });

  it("keeps the Resend delivery journal tenant-isolated with server-only webhook writes", async () => {
    const messageA = "re_rls_msg_a";
    const messageB = "re_rls_msg_b";
    const messageReset = "re_rls_msg_reset";
    const svixA = "msg_rls_svix_a";
    const digest = "a".repeat(64);
    try {
      // A tenant session cannot write either table directly: the only write
      // path is the transaction-local app.resend_webhook flag set by the
      // server-only webhook store.
      await expect(
        inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().$executeRaw(Prisma.sql`
            insert into email_delivery_messages (provider_message_id, org_id, kind, recipient_digest, status)
            values (${messageA}, ${orgA}::uuid, 'customer_portal_access', ${digest}, 'sent')
          `),
        ),
      ).rejects.toThrow();
      await expect(
        inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().$executeRaw(Prisma.sql`
            insert into email_delivery_events (svix_id, event_type, provider_message_id, org_id, payload_digest, metadata)
            values (${svixA}, 'email.delivered', ${messageA}, ${orgA}::uuid, ${digest}, '{}'::jsonb)
          `),
        ),
      ).rejects.toThrow();

      // The server-only webhook transaction can write, resolves org from the
      // journal row, and a duplicate svix-id is a no-op.
      await inResendWebhookSession(async (transaction) => {
        await transaction.$executeRaw(Prisma.sql`
          insert into email_delivery_messages (provider_message_id, org_id, kind, recipient_digest, status)
          values (${messageA}, ${orgA}::uuid, 'customer_portal_access', ${digest}, 'sent'),
                 (${messageB}, ${orgB}::uuid, 'customer_portal_access', ${digest}, 'sent'),
                 (${messageReset}, NULL, 'password_reset', ${digest}, 'sent')
        `);
        const inserted = await transaction.$queryRaw<Array<{ org_id: string | null }>>(Prisma.sql`
          insert into email_delivery_events (svix_id, event_type, provider_message_id, org_id, payload_digest, metadata)
          values (${svixA}, 'email.delivered', ${messageA},
            (select org_id from email_delivery_messages where provider_message_id = ${messageA}),
            ${digest}, '{"eventType":"email.delivered"}'::jsonb)
          on conflict (svix_id) do nothing
          returning org_id::text as org_id
        `);
        expect(inserted).toHaveLength(1);
        expect(inserted[0]?.org_id).toBe(orgA);
        await transaction.$executeRaw(Prisma.sql`
          update email_delivery_messages set status = 'delivered', updated_at = now()
          where provider_message_id = ${messageA}
        `);
        const duplicate = await transaction.$queryRaw<Array<{ svix_id: string }>>(Prisma.sql`
          insert into email_delivery_events (svix_id, event_type, provider_message_id, org_id, payload_digest, metadata)
          values (${svixA}, 'email.delivered', ${messageA}, ${orgA}::uuid, ${digest}, '{}'::jsonb)
          on conflict (svix_id) do nothing
          returning svix_id
        `);
        expect(duplicate).toHaveLength(0);
      });

      // Tenant reads are org-scoped. The user-wide (NULL org) password-reset
      // row is visible to no tenant session, and org B cannot see org A's
      // message or event rows.
      const adminVisible = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().$queryRaw<Array<{ provider_message_id: string; status: string }>>(Prisma.sql`
          select provider_message_id, status from email_delivery_messages order by provider_message_id
        `),
      );
      expect(adminVisible).toEqual([{ provider_message_id: messageA, status: "delivered" }]);
      const otherVisible = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().$queryRaw<Array<{ provider_message_id: string }>>(Prisma.sql`
          select provider_message_id from email_delivery_messages order by provider_message_id
        `),
      );
      expect(otherVisible).toEqual([{ provider_message_id: messageB }]);
      const otherEvents = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().$queryRaw<Array<{ svix_id: string }>>(Prisma.sql`
          select svix_id from email_delivery_events where svix_id = ${svixA}
        `),
      );
      expect(otherEvents).toHaveLength(0);
    } finally {
      await adminClient.$executeRaw(Prisma.sql`
        delete from email_delivery_events where svix_id in (${svixA})
      `);
      await adminClient.$executeRaw(Prisma.sql`
        delete from email_delivery_messages where provider_message_id in (${messageA}, ${messageB}, ${messageReset})
      `);
    }
  });


  it("serializes concurrent expense updates so each audit before state matches committed reality", async () => {
    const expenseId = randomUUID();
    await adminClient.jobExpense.create({
      data: {
        id: expenseId, orgId: orgA, jobId: jobA,
        amountCents: 1000, category: "material", paymentResponsibility: "contractor",
        vendor: "", receiptNote: "", incurredOn: new Date("2026-11-01T00:00:00.000Z"),
        createdById: adminUser,
      },
    });
    try {
      const expenses = new JobExpensesService();
      const results = await Promise.allSettled([
        inSession(adminUser, orgA, "admin", async () =>
          expenses.update({ id: expenseId, orgId: orgA, jobId: jobA, actorUserId: adminUser, amountCents: 2000 })
        ),
        inSession(technicianUser, orgA, "technician", async () =>
          expenses.update({ id: expenseId, orgId: orgA, jobId: jobA, actorUserId: technicianUser, amountCents: 3000 })
        ),
      ]);
      expect(results.every((result) => result.status === "fulfilled")).toBe(true);

      const events = await adminClient.jobExpenseEvent.findMany({
        where: { expenseId, eventType: "updated" },
      });
      const transitions = events.map((event) => event.payloadJson as unknown as {
        before: { amountCents: number }; after: { amountCents: number };
      });
      expect(transitions).toHaveLength(2);
      expect(transitions.map((p) => p.after.amountCents).sort((a, b) => a - b)).toEqual([2000, 3000]);
      const first = transitions.filter((p) => p.before.amountCents === 1000);
      expect(first).toHaveLength(1);
      expect(transitions.filter((p) => p.before.amountCents === first[0].after.amountCents)).toHaveLength(1);
    } finally {
      await adminClient.jobExpenseEvent.deleteMany({ where: { expenseId } });
      await adminClient.jobExpense.delete({ where: { id: expenseId } });
    }
  });

  it("denies an unassigned same-organization technician job reads and completion at the database boundary", async () => {
    const unassignedJob = randomUUID();
    const assignedTechnician = randomUUID();
    const assignedMembership = randomUUID();
    const assignedRow = randomUUID();
    await adminClient.job.create({ data: {
      id: unassignedJob, orgId: orgA, projectId: projectA,
      customerId: customerA, serviceAddressId: serviceAddressA,
      jobNumber: `UNASSIGNED-${unassignedJob}`, title: "Unassigned denial fixture",
      jobType: "HVAC Service", status: "on_site", priority: "medium", createdById: adminUser,
    } });
    try {
      await adminClient.appUser.create({ data: { id: assignedTechnician, authSubject: assignedTechnician, email: `rls-${assignedTechnician}@example.com` } });
      await adminClient.organizationMembership.create({ data: { id: assignedMembership, orgId: orgA, userId: assignedTechnician, role: "technician", status: "active" } });
      const hidden = await inSession(technicianUser, orgA, "technician", async () =>
        currentTransaction().job.findUnique({ where: { id: unassignedJob } })
      );
      expect(hidden).toBeNull();
      const update = await inSession(technicianUser, orgA, "technician", async () =>
        currentTransaction().job.updateMany({ where: { id: unassignedJob }, data: { status: "completed" } })
      );
      expect(update.count).toBe(0);
      await expect(inSession(technicianUser, orgA, "technician", async () =>
        new JobsService().getById(orgA, unassignedJob, { userId: technicianUser, role: "technician" })
      )).rejects.toMatchObject({ statusCode: 404 });
      await expect(inSession(technicianUser, orgA, "technician", async () =>
        new JobsService().complete(unassignedJob, {
          orgId: orgA, actor: { userId: technicianUser, orgId: orgA, role: "technician" },
        })
      )).rejects.toMatchObject({ statusCode: 404 });
      await adminClient.jobAssignment.create({ data: {
        id: assignedRow, orgId: orgA, jobId: unassignedJob, userId: assignedTechnician,
        assignmentRole: "lead", isLead: true, assignedById: adminUser,
      } });
      const hiddenAssignedElsewhere = await inSession(technicianUser, orgA, "technician", async () =>
        currentTransaction().job.findUnique({ where: { id: unassignedJob } })
      );
      expect(hiddenAssignedElsewhere).toBeNull();
      const deniedAssignedElsewhere = await inSession(technicianUser, orgA, "technician", async () =>
        currentTransaction().job.updateMany({ where: { id: unassignedJob }, data: { status: "completed" } })
      );
      expect(deniedAssignedElsewhere.count).toBe(0);
      expect((await adminClient.job.findUnique({ where: { id: unassignedJob } }))?.status).toBe("on_site");
      expect(await adminClient.activityEvent.count({ where: { orgId: orgA, entityType: "job", entityId: unassignedJob } })).toBe(0);
    } finally {
      await adminClient.activityEvent.deleteMany({ where: { orgId: orgA, entityType: "job", entityId: unassignedJob } });
      await adminClient.jobAssignment.deleteMany({ where: { id: assignedRow } });
      await adminClient.job.delete({ where: { id: unassignedJob } });
      await adminClient.organizationMembership.deleteMany({ where: { id: assignedMembership } });
      await adminClient.appUser.deleteMany({ where: { id: assignedTechnician } });
    }
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

    const hiddenActivity = await inSession(otherUser, orgB, "owner", async () =>
      currentTransaction().activityEvent.findUnique({ where: { id: activityEventA } })
    );
    expect(hiddenActivity).toBeNull();

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
          and c.relkind = 'r'
          and exists (
            select 1
            from information_schema.columns column_info
            where column_info.table_schema = 'public'
              and column_info.table_name = c.relname
              and column_info.column_name = 'org_id'
          )
        order by c.relname
      `
    );
    expect(tables.length).toBeGreaterThan(4);
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

  it("grants the restricted role execute on the ABC OAuth state wrappers with tenant binding", async () => {
    const stateHash = `it-state-${randomUUID()}`;
    const bindingHash = `it-binding-${randomUUID()}`;
    const callbackUri = "https://api.404tradeos.com/api/v1/supplier-integrations/abc/oauth/callback";

    // Without the provision-app-role.sql grants, every call below fails with
    // "permission denied for function" under the restricted connection.
    await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().$executeRaw(Prisma.sql`
        select tradeos_private.create_abc_oauth_state(
          ${orgA}::uuid, ${adminUser}::uuid, ${supplierA}::uuid,
          ${stateHash}, ${"it-verifier"}, ${callbackUri}, ${bindingHash}, 600
        )`),
    );

    // A wrong browser binding does not consume the state (RFC 6749 section 10.12).
    const mismatched = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().$queryRaw<Array<{ org_id: string }>>(Prisma.sql`
        select org_id from tradeos_private.consume_abc_oauth_state(${stateHash}, ${"wrong-binding"})`),
    );
    expect(mismatched).toHaveLength(0);

    // The correct binding consumes exactly once and returns the tenant context.
    const consumed = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().$queryRaw<Array<{ org_id: string; user_id: string; supplier_id: string }>>(Prisma.sql`
        select org_id, user_id, supplier_id
        from tradeos_private.consume_abc_oauth_state(${stateHash}, ${bindingHash})`),
    );
    expect(consumed).toHaveLength(1);
    expect(consumed[0]).toMatchObject({ org_id: orgA, user_id: adminUser, supplier_id: supplierA });

    // Replay returns nothing.
    const replay = await inSession(adminUser, orgA, "admin", async () =>
      currentTransaction().$queryRaw<Array<{ org_id: string }>>(Prisma.sql`
        select org_id from tradeos_private.consume_abc_oauth_state(${stateHash}, ${bindingHash})`),
    );
    expect(replay).toHaveLength(0);

    // Creation rejects a tenant session that does not match the parameters.
    await expect(
      inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().$executeRaw(Prisma.sql`
          select tradeos_private.create_abc_oauth_state(
            ${orgB}::uuid, ${adminUser}::uuid, ${supplierA}::uuid,
            ${`it-other-${randomUUID()}`}, ${"v"}, ${callbackUri}, ${"b"}, 600
          )`),
      ),
    ).rejects.toThrow();
  });

  it("creates ABC OAuth states through the module path only inside a tenant session", async () => {
    process.env.ABC_OAUTH_STATE_HMAC_SECRET = "integration-test-hmac-secret-not-a-real-secret";
    const request = { orgId: orgA, userId: adminUser, supplierId: supplierA };

    // Regression: the authorize endpoint 500'd in production because the TTL
    // reached Postgres as bigint while the wrapper takes integer (42883). The
    // module path must also fail closed without a tenant session, per the
    // wrapper's contract.
    await expect(createAuthorizationState(request)).rejects.toThrow();

    // Inside the request's tenant session (as the endpoint now does), the module
    // path creates the state and the callback path consumes it exactly once.
    const created = await inSession(adminUser, orgA, "admin", () => createAuthorizationState(request));
    expect(created.state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(created.codeChallenge).toBeTruthy();
    expect(created.browserBinding).toBeTruthy();

    const consumed = await consumeAuthorizationState(created.state, created.browserBinding);
    expect(consumed).toMatchObject({ orgId: orgA, userId: adminUser, supplierId: supplierA });
    expect(consumed?.codeVerifier).toBeTruthy();

    // Single-use: a second consume returns nothing.
    await expect(consumeAuthorizationState(created.state, created.browserBinding)).resolves.toBeNull();
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

  it("scopes assembly upgrade audit history and blocks forged or rewritten records", async () => {
    const recipeId = "site-excavation";
    const assembly = await adminClient.assembly.create({ data: {
      orgId: orgA, code: "RECIPE-UPGRADE-AUDIT", name: "Upgrade audit fixture", unitOfMeasure: "CY",
      isTemplate: true, installedRecipeId: recipeId, installedRecipeVersion: 2, installedAt: new Date(),
    } });
    const audit = { assemblyId: assembly.id, recipeId, fromVersion: 1, toVersion: 2 };
    await expect(inSession(otherUser, orgB, "owner", () =>
      currentTransaction().assemblyRecipeUpgrade.create({ data: { ...audit, actorId: otherUser } }),
    )).rejects.toThrow(/row-level security/i);
    await expect(inSession(technicianUser, orgA, "technician", () =>
      currentTransaction().assemblyRecipeUpgrade.create({ data: { ...audit, actorId: technicianUser } }),
    )).rejects.toThrow(/row-level security/i);
    await expect(inSession(adminUser, orgA, "admin", () =>
      currentTransaction().assemblyRecipeUpgrade.create({ data: { ...audit, actorId: otherUser } }),
    )).rejects.toThrow(/row-level security/i);

    const saved = await inSession(adminUser, orgA, "admin", () =>
      currentTransaction().assemblyRecipeUpgrade.create({ data: { ...audit, actorId: adminUser } }),
    );
    const where = { id: saved.id };
    expect(await inSession(technicianUser, orgA, "technician", () =>
      currentTransaction().assemblyRecipeUpgrade.findUnique({ where }),
    )).toEqual(saved);
    expect(await inSession(otherUser, orgB, "owner", () =>
      currentTransaction().assemblyRecipeUpgrade.findUnique({ where }),
    )).toBeNull();
    expect(await inSession(adminUser, orgA, "admin", () =>
      currentTransaction().assemblyRecipeUpgrade.updateMany({ where, data: { actorId: otherUser } }),
    )).toEqual({ count: 0 });
    expect(await inSession(adminUser, orgA, "admin", () =>
      currentTransaction().assemblyRecipeUpgrade.deleteMany({ where }),
    )).toEqual({ count: 0 });
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

  it("commits one recoverable invoice and creation event across concurrent retries", async () => {
    const key = randomUUID();
    const service = new InvoicesService();
    const input = {
      orgId: orgA, projectId: projectA, actorUserId: adminUser, actorRole: "admin",
      lineItems: [{ description: "Recovery fixture", quantity: 2, unitOfMeasure: "EA", unitPrice: 150 }],
    };
    const create = () => inSession(adminUser, orgA, "admin", () => service.createWithIdempotency(input, key));
    const [first, second] = await Promise.all([create(), create()]);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    const id = first.invoice.id;
    expect(second.invoice.id).toBe(id);
    await expect(create()).resolves.toMatchObject({ invoice: { id, amount: 300, status: "draft" }, replayed: true });

    const persisted = await inSession(adminUser, orgA, "admin", async () => {
      const tx = currentTransaction();
      const invoices = await tx.invoice.findMany({ where: { projectId: projectA, createRequestKey: key } });
      const events = await tx.invoiceDelivery.findMany({ where: { invoiceId: id } });
      return { invoices, events };
    });
    expect(persisted.invoices).toHaveLength(1);
    expect(persisted.invoices[0]).toMatchObject({ id, createRequestKey: key, createRequestHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(persisted.events.map((event) => event.eventType)).toEqual(["invoice.created"]);

    const pdf = await inSession(adminUser, orgA, "admin", () => service.getPdf(id, orgA));
    expect(pdf.contentType).toBe("application/pdf");
    expect(pdf.filename.endsWith(`-${first.invoice.invoiceNumber}.pdf`)).toBe(true);
    expect(pdf.buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const pdfText = extractPdfText(pdf.buffer);
    expect(pdfText).toContain(`Invoice #${first.invoice.invoiceNumber}`);
    expect(pdfText).toMatch(/Recovery fixture[^\n]*\$300\.00/);
    expect(pdfText).toMatch(/Total\s+\$300\.00/);
    expect(pdfText).toMatch(/Balance due\s+\$300\.00/);
    await expect(inSession(otherUser, orgB, "owner", () => service.getPdf(id, orgB)))
      .rejects.toMatchObject({ statusCode: 404 });

    await expect(inSession(adminUser, orgA, "admin", () => service.createWithIdempotency({
      ...input, lineItems: [{ ...input.lineItems[0], unitPrice: 175 }],
    }, key))).rejects.toMatchObject({ statusCode: 409 });
    await expect(inSession(viewerUser, orgA, "viewer", () => service.createWithIdempotency({
      ...input, actorUserId: viewerUser, actorRole: "viewer",
    }, key))).rejects.toMatchObject({ statusCode: 403 });
    await expect(inSession(otherUser, orgB, "owner", () => service.createWithIdempotency({
      ...input, orgId: orgB, actorUserId: otherUser, actorRole: "owner",
    }, key))).rejects.toMatchObject({ statusCode: 404 });
    await expect(inSession(otherUser, orgB, "owner", () => service.getById(id, orgB))).rejects.toMatchObject({ statusCode: 404 });
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
          lineItems: [{ description: "Deposit", quantity: 1, unitOfMeasure: "EA", unitPrice: 1000 }],
        })
      )
    ).rejects.toThrow();

    const invoice = await inSession(adminUser, orgA, "admin", async () =>
      new InvoicesService().create({
        orgId: orgA,
        projectId: projectA,
        actorUserId: adminUser,
        actorRole: "admin",
        estimateId: estimateA,
        proposalId: proposal.id,
      })
    );
    expect(invoice.amount).toBe(200);
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

    // Read-only aggregate: a non-admin, unassigned session must not be
    // blocked by an application-level permission check (no ApiError thrown).
    // Note this app's jobs_select_policy RLS (see
    // prisma/migrations/20260825103000_harden_declined_job_rls_visibility)
    // restricts *row visibility* on the jobs table itself to admin/owner or
    // an active (non-declined) assignee — dispatcher is not in the SELECT
    // policy (it appears only in the INSERT policy), so a "viewer" role
    // session legitimately sees zero job rows
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
        data: { id: estimateQueueA2, orgId: orgA, projectId: projectA, version: 11, status: "sent", subtotalCost: 600, overheadPct: 10, totalPrice: 1000 },
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
      expect(unsigned.items.map((item) => item.id)).toEqual(expect.arrayContaining([proposalQueueA1]));
      expect(unsigned.items.find((item) => item.id === proposalQueueA1)?.contractId).toBeNull();

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

    it("financial summary: aggregates the session organization and forced RLS rejects a guessed organization", async () => {
      const generatedAt = new Date();
      const own = await inSession(adminUser, orgA, "admin", async () =>
        new FinancialSummaryService().getOrganizationSummary(orgA, generatedAt)
      );

      expect(own.receivables.coverage.status).toBe("complete");
      expect(own.receivables.openAmount).toBeGreaterThanOrEqual(1600);
      expect(own.receivables.overdueAmount).toBeGreaterThanOrEqual(1600);
      expect(own.unsignedOpportunity.amount).toBeGreaterThanOrEqual(750);
      expect(own.projectedCommittedMargin).toMatchObject({
        coverage: { status: "complete" },
        estimateCount: expect.any(Number),
      });
      expect(own.projectedCommittedMargin.estimateCount).toBeGreaterThanOrEqual(1);
      expect(own.projectedCommittedMargin.costAmount).toBeGreaterThanOrEqual(660);
      expect(own.actualJobCosts).toMatchObject({ amount: null, coverage: { status: "unavailable" } });

      const guessed = await inSession(adminUser, orgA, "admin", async () =>
        new FinancialSummaryService().getOrganizationSummary(orgB, generatedAt)
      );
      expect(guessed.receivables).toMatchObject({ openAmount: 0, overdueAmount: 0, openInvoiceCount: 0, overdueInvoiceCount: 0 });
      expect(guessed.unsignedOpportunity).toMatchObject({ amount: 0, proposalCount: 0 });
      expect(guessed.projectedCommittedMargin).toMatchObject({ sellAmount: 0, costAmount: 0, estimateCount: 0 });
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
            otherUser,
            "owner"
          )
        )
      ).rejects.toMatchObject({ statusCode: 404 });

      await inSession(adminUser, orgA, "admin", async () =>
        new CrmService().createPayment(
          orgA,
          invoiceQueueA4,
          { amount: 1000, paymentDate: "2026-07-15T00:00:00.000Z", method: "card" },
          adminUser,
          "admin"
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

  describe("customer portal policies", () => {
    const portalSessionId = "10000000-0000-0000-0000-000000000301";

    it("restricts customer portal reads to the verified customer's tenant and projects", async () => {
      const result = await runWithPortalDatabaseSession(
        appClient,
        { sessionId: portalSessionId, accessTokenId: "10000000-0000-0000-0000-000000000302", orgId: orgA, customerId: customerA },
        async () => ({
          projects: await currentTransaction().project.findMany({ orderBy: { id: "asc" } }),
          customers: await currentTransaction().customer.findMany({ orderBy: { id: "asc" } }),
          foreignProject: await currentTransaction().project.findUnique({ where: { id: projectB } }),
          foreignCustomer: await currentTransaction().customer.findUnique({ where: { id: customerB } }),
        }),
      );

      expect(result.projects.map((project) => project.id)).toEqual([projectA]);
      expect(result.customers.map((customer) => customer.id)).toEqual([customerA]);
      expect(result.foreignProject).toBeNull();
      expect(result.foreignCustomer).toBeNull();
    });

    it("allows only the exact pending customer contract to transition and records no staff actor", async () => {
      const denied = await runWithPortalDatabaseSession(
        appClient,
        { sessionId: portalSessionId, accessTokenId: "10000000-0000-0000-0000-000000000303", orgId: orgA, customerId: customerA },
        async () => {
          await currentTransaction().$queryRaw(Prisma.sql`select set_config('app.portal_contract_id', ${"10000000-0000-0000-0000-000000000304"}, true)`);
          return currentTransaction().contract.updateMany({
            where: { id: portalContractA, status: "pending_signature" },
            data: { status: "signed", signedAt: new Date() },
          });
        },
      );
      expect(denied.count).toBe(0);

      const signed = await runWithPortalDatabaseSession(
        appClient,
        { sessionId: portalSessionId, accessTokenId: "10000000-0000-0000-0000-000000000305", orgId: orgA, customerId: customerA },
        async () => {
          await currentTransaction().$queryRaw(Prisma.sql`select set_config('app.portal_contract_id', ${portalContractA}, true)`);
          const updated = await currentTransaction().contract.updateMany({
            where: { id: portalContractA, status: "pending_signature" },
            data: {
              status: "signed",
              signerName: "Org A Customer",
              signerEmail: "orga@example.com",
              signedAt: new Date(),
            },
          });
          const event = await currentTransaction().contractEvent.create({
            data: {
              orgId: orgA,
              contractId: portalContractA,
              eventType: "contract.signed",
              actorUserId: null,
              recipientEmail: "orga@example.com",
              metadataJson: { actorType: "customer_portal", customerId: customerA, portalSessionId },
            },
          });
          const activity = await currentTransaction().activityEvent.create({
            data: {
              orgId: orgA,
              entityType: "project",
              entityId: projectA,
              eventType: "contract.signed",
              title: "Contract signed",
              actorUserId: null,
              metadataJson: { actorType: "customer_portal", customerId: customerA, portalSessionId },
            },
          });
          return { updated, event, activity };
        },
      );

      expect(signed.updated.count).toBe(1);
      expect(signed.event.actorUserId).toBeNull();
      expect(signed.event.metadataJson).toMatchObject({ actorType: "customer_portal", customerId: customerA });
      expect(signed.activity.actorUserId).toBeNull();
    });

    // DES-7 (c): portal mark-viewed is the second customer-originated
    // write. The portal session carries app.role = 'portal_customer', so
    // the staff write policies deny it; the 20261123120100 migration grants
    // one narrowly scoped portal UPDATE policy + trigger keyed by the
    // transaction-local app.portal_invoice_id.
    it("lets a portal session record the first view of its own sent invoice, and nothing else", async () => {
      const invoice = await inSession(adminUser, orgA, "admin", async () =>
        new InvoicesService().create({
          orgId: orgA,
          projectId: projectA,
          actorUserId: adminUser,
          actorRole: "admin",
          lineItems: [{ description: "Portal view fixture", quantity: 1, unitOfMeasure: "EA", unitPrice: 250 }],
        })
      );
      const sent = await inSession(adminUser, orgA, "admin", async () => new InvoicesService().send(invoice.id, orgA, adminUser, "admin"));
      expect(sent.status).toBe("sent");

      const portalContext = (accessTokenId: string, orgId: string, customerId: string) => ({
        sessionId: portalSessionId,
        accessTokenId,
        orgId,
        customerId,
      });

      // A portal session for another tenant cannot even see the invoice.
      await expect(
        runWithPortalDatabaseSession(
          appClient,
          portalContext("10000000-0000-0000-0000-000000000306", orgB, customerB),
          async () => new InvoicesService().markViewed(invoice.id, orgB)
        )
      ).rejects.toMatchObject({ statusCode: 404 });

      // The owning customer's portal session marks it viewed exactly once.
      const viewed = await runWithPortalDatabaseSession(
        appClient,
        portalContext("10000000-0000-0000-0000-000000000307", orgA, customerA),
        async () => new InvoicesService().markViewed(invoice.id, orgA)
      );
      expect(viewed.status).toBe("viewed");
      expect(viewed.viewedAt).not.toBeNull();

      const deliveries = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().invoiceDelivery.findMany({ where: { invoiceId: invoice.id }, orderBy: { occurredAt: "desc" } })
      );
      const viewedEvents = deliveries.filter((delivery) => delivery.eventType === "invoice.viewed");
      expect(viewedEvents).toHaveLength(1);
      expect(viewedEvents[0]?.deliveryChannel).toBe("portal");
      expect(viewedEvents[0]?.actorUserId).toBeNull();

      // A repeat view writes nothing new.
      const again = await runWithPortalDatabaseSession(
        appClient,
        portalContext("10000000-0000-0000-0000-000000000308", orgA, customerA),
        async () => new InvoicesService().markViewed(invoice.id, orgA)
      );
      expect(again.status).toBe("viewed");
      const deliveriesAfter = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().invoiceDelivery.findMany({ where: { invoiceId: invoice.id, eventType: "invoice.viewed" } })
      );
      expect(deliveriesAfter).toHaveLength(1);

      // A portal session cannot rewrite the invoice: the trigger rejects
      // anything beyond recording the first view.
      await expect(
        runWithPortalDatabaseSession(
          appClient,
          portalContext("10000000-0000-0000-0000-000000000309", orgA, customerA),
          async () => {
            await currentTransaction().$queryRaw(Prisma.sql`select set_config('app.portal_invoice_id', ${invoice.id}, true)`);
            return currentTransaction().invoice.updateMany({ where: { id: invoice.id }, data: { amount: 1 } });
          }
        )
      ).rejects.toThrow("Customer portal viewing may only record the first view");
    });
  });

  describe("codes_job_assessment row-level security", () => {
    const assessmentA = "10000000-0000-0000-0000-000000000131";

    beforeAll(async () => {
      await adminClient.codesJobAssessment.create({
        data: {
          id: assessmentA,
          orgId: orgA,
          projectId: projectA,
          estimateId: estimateA,
          workType: "sign replacement",
          status: "needs_review",
          citations: [{ source_id: "vigo-zoning-signs", rationale: "County sign rules must be confirmed." }],
          unknowns: ["Confirm the zoning district."],
          createdBy: adminUser,
        },
      });
    });

    it("shows an assessment only to its own org, never across tenants", async () => {
      const visible = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesJobAssessment.findUnique({ where: { id: assessmentA } }),
      );
      expect(visible?.orgId).toBe(orgA);
      expect(visible?.projectId).toBe(projectA);

      const hiddenCrossOrg = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().codesJobAssessment.findUnique({ where: { id: assessmentA } }),
      );
      expect(hiddenCrossOrg).toBeNull();
    });

    it("allows a same-org insert for the org's own project and estimate", async () => {
      const inserted = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesJobAssessment.create({
          data: {
            id: randomUUID(),
            orgId: orgA,
            projectId: projectA,
            estimateId: estimateA,
            workType: "electrical run",
            status: "needs_review",
            citations: [],
            unknowns: ["Confirm the authorized connection."],
            createdBy: adminUser,
          },
        }),
      );
      expect(inserted.orgId).toBe(orgA);
      expect(inserted.projectId).toBe(projectA);
    });

    it("refuses a cross-tenant insert for another org's project", async () => {
      await expect(
        inSession(otherUser, orgB, "owner", async () =>
          currentTransaction().codesJobAssessment.create({
            data: {
              id: randomUUID(),
              orgId: orgB,
              projectId: projectA,
              estimateId: estimateA,
              workType: "sign replacement",
              status: "needs_review",
              citations: [],
              unknowns: [],
              createdBy: otherUser,
            },
          }),
        ),
      ).rejects.toThrow();
    });

    it("refuses an insert that spoofs another org's id from inside a session", async () => {
      await expect(
        inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().codesJobAssessment.create({
            data: {
              id: randomUUID(),
              orgId: orgB,
              projectId: projectA,
              workType: "sign replacement",
              status: "needs_review",
              citations: [],
              unknowns: [],
              createdBy: adminUser,
            },
          }),
        ),
      ).rejects.toThrow();
    });

    it("refuses an insert whose estimate does not belong to the project", async () => {
      await expect(
        inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().codesJobAssessment.create({
            data: {
              id: randomUUID(),
              orgId: orgA,
              projectId: projectA,
              estimateId: randomUUID(),
              workType: "sign replacement",
              status: "needs_review",
              citations: [],
              unknowns: [],
              createdBy: adminUser,
            },
          }),
        ),
      ).rejects.toThrow();
    });

    it("refuses cross-tenant updates and deletes (zero rows affected)", async () => {
      const updated = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().codesJobAssessment.updateMany({
          where: { id: assessmentA },
          data: { status: "owner_approved", ownerSignoff: true },
        }),
      );
      expect(updated.count).toBe(0);

      const deleted = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().codesJobAssessment.deleteMany({ where: { id: assessmentA } }),
      );
      expect(deleted.count).toBe(0);

      const intact = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesJobAssessment.findUnique({ where: { id: assessmentA } }),
      );
      expect(intact?.status).toBe("needs_review");
      expect(intact?.ownerSignoff).toBe(false);
    });

    it("refuses a same-org update that re-points the assessment at another org's project", async () => {
      // The update policy WITH CHECK enforces the same parent-reference
      // invariant as the insert policy: project_id must belong to the
      // session org. Re-pointing at org B's project must fail outright.
      await expect(
        inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().codesJobAssessment.updateMany({
            where: { id: assessmentA },
            data: { projectId: projectB },
          }),
        ),
      ).rejects.toThrow();

      const intact = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesJobAssessment.findUnique({ where: { id: assessmentA } }),
      );
      expect(intact?.projectId).toBe(projectA);
      expect(intact?.status).toBe("needs_review");
    });

    it("allows a same-org update that keeps the assessment on its own project", async () => {
      // Guards the new WITH CHECK against breaking legitimate updates:
      // the sign-off path updates status/signoff on the same row.
      const updated = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesJobAssessment.updateMany({
          where: { id: assessmentA },
          data: { unknowns: ["Confirm the zoning district.", "Confirm the permit office."] },
        }),
      );
      expect(updated.count).toBe(1);

      const row = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesJobAssessment.findUnique({ where: { id: assessmentA } }),
      );
      expect(row?.unknowns).toHaveLength(2);
      await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().codesJobAssessment.updateMany({
          where: { id: assessmentA },
          data: { unknowns: ["Confirm the zoning district."] },
        }),
      );
    });
  });
  describe("codes_source governed ingestion RLS (issue #946, TODO 3)", () => {
    // Depends on TODO 2's tables (codes_source, codes_source_history) and
    // its seed rows (PR #960, `feat/codes-permits-registry-946`, head
    // 9cdea60d). Jurisdiction/authority ids below are TODO 2's FIXED seed
    // UUIDs, so no seeder is needed: the migration inserts them
    // idempotently (ON CONFLICT DO NOTHING).
    //   INDOT authority  94600001-0000-4000-8000-000000000003
    //   Indiana (INDOT) jurisdiction 94600002-0000-4000-8000-000000000003
    //
    // Uniqueness note (#960): (authority_id, code_family, citation,
    // version_label) is UNIQUE, so every seeded/ingested row in this block
    // uses a DISTINCT citation — two rows for one citation would collide
    // even on different URLs.
    const codesStore = new PrismaCodesSourceStore();
    const codesJurisdictionId = "94600002-0000-4000-8000-000000000003";
    const codesAuthorityId = "94600001-0000-4000-8000-000000000003";
    // Deliberately distinct from every URL seeded by the other tests in
    // this block: the ingest test expects its first version to be `v1`,
    // which only holds when no earlier version exists for the same citation.
    const codesSourceUrl = "https://www.in.gov/indot/permits/governed-ingest-test/";
    const codesAdminAuth: AuthContext = { userId: adminUser, orgId: orgA, role: "admin" };
    const codesOtherAuth: AuthContext = { userId: otherUser, orgId: orgB, role: "owner" };
    const codesTechnicianAuth: AuthContext = { userId: technicianUser, orgId: orgA, role: "technician" };

    // The integration suites share one disposable database and run in
    // band with rls.integration.ts first, so rows this block inserts are
    // visible to later suites: the registry suite counts statewide
    // reviewed rows and total codes_source rows. Remove exactly the rows
    // this block created (distinct citations, history first — its
    // source_id FK is Restrict), restoring the shared DB to seed state.
    // ActivityEvents are org-scoped audit rows on another table and go
    // away with the outer afterAll's org cleanup.
    const codesFixtureCitations = [
      "INDOT — Global read fixture",
      "INDOT — Direct write fixture",
      "INDOT — Governed ingest test",
      "INDOT — Approval test",
      "INDOT — Expired fixture",
    ];
    afterAll(async () => {
      await adminClient.$queryRaw(Prisma.sql`
        delete from codes_source_history where source_id in (
          select id from codes_source where citation in (${Prisma.join(codesFixtureCitations)})
        )
      `);
      await adminClient.$queryRaw(Prisma.sql`
        delete from codes_source where citation in (${Prisma.join(codesFixtureCitations)})
      `);
    });

    async function seedReviewedSource(input: { citation: string; sourceUrl: string; expiryDate: string | null; sourceHash: string }): Promise<string> {
      const id = randomUUID();
      await adminClient.$queryRaw(Prisma.sql`
        insert into codes_source (
          id, jurisdiction_id, authority_id, code_family, section, citation, title,
          source_url, source_hash, license_note,
          published_date, amended_date, effective_date, expiry_date,
          status, reviewed_at, reviewed_by, version_label, supersedes_id
        ) values (
          ${id}::uuid, ${codesJurisdictionId}::uuid, ${codesAuthorityId}::uuid, 'sign-permits', null,
          ${input.citation}, 'INDOT outdoor advertising sign permits',
          ${input.sourceUrl}, ${input.sourceHash}, null,
          null, null, null, ${input.expiryDate ? Prisma.sql`${input.expiryDate}::date` : Prisma.sql`NULL`},
          'reviewed', now(), ${adminUser}, 'v1', NULL
        )
      `);
      return id;
    }

    it("reads the shared reference globally: both tenants see the same reviewed source", async () => {
      const sourceId = await seedReviewedSource({
        citation: "INDOT — Global read fixture",
        sourceUrl: "https://www.in.gov/indot/doing-business-with-indot/permits/",
        expiryDate: null,
        sourceHash: "a".repeat(64),
      });
      const seenByOrgA = await inSession(adminUser, orgA, "admin", () => codesStore.getById(sourceId));
      const seenByOrgB = await inSession(otherUser, orgB, "owner", () => codesStore.getById(sourceId));
      expect(seenByOrgA?.id).toBe(sourceId);
      expect(seenByOrgB?.id).toBe(sourceId);
      const listedByOrgB = await inSession(otherUser, orgB, "owner", () => codesStore.list({}));
      expect(listedByOrgB.some((row) => row.id === sourceId)).toBe(true);
    });

    it("denies direct tenant writes without the ingestion flag", async () => {
      const sourceId = await seedReviewedSource({
        citation: "INDOT — Direct write fixture",
        sourceUrl: "https://www.in.gov/dhs/boards-and-commissions/fpbsc-rules/",
        expiryDate: null,
        sourceHash: "b".repeat(64),
      });
      await expect(
        inSession(adminUser, orgA, "admin", () =>
          currentTransaction().$queryRaw(Prisma.sql`
            insert into codes_source (
              jurisdiction_id, authority_id, code_family, section, citation, title,
              source_url, source_hash, license_note,
              published_date, amended_date, effective_date, expiry_date,
              status, reviewed_at, reviewed_by, version_label, supersedes_id
            ) values (
              ${codesJurisdictionId}::uuid, ${codesAuthorityId}::uuid, 'sign-permits', null, 'direct', 'direct',
              'https://www.in.gov/indot/direct-write/', ${"c".repeat(64)}, null,
              null, null, null, null,
              'research', null, null, 'v1', null
            )
          `),
        ),
      ).rejects.toThrow(/row-level security/);
      // UPDATE/DELETE under RLS do NOT throw: a row the session's policy
      // hides is silently skipped, so the denial is proven by effect —
      // zero rows affected — not by an error. (INSERT does throw, via
      // WITH CHECK, and keeps the rejects assertion above. The sibling
      // registry suite documents the same split: denial reaches Prisma
      // as 42501 or P2025 through the client, and as zero affected rows
      // through raw SQL.)
      const updated = await inSession(adminUser, orgA, "admin", () =>
        currentTransaction().$executeRaw(Prisma.sql`
          update codes_source set title = 'direct edit' where id = ${sourceId}::uuid
        `),
      );
      expect(updated).toBe(0);
      const deleted = await inSession(adminUser, orgA, "admin", () =>
        currentTransaction().$executeRaw(Prisma.sql`
          delete from codes_source where id = ${sourceId}::uuid
        `),
      );
      expect(deleted).toBe(0);
      await expect(
        inSession(adminUser, orgA, "admin", () =>
          currentTransaction().$queryRaw(Prisma.sql`
            insert into codes_source_history (source_id, version_label, source_hash, status, change_summary, recorded_by)
            values (${sourceId}::uuid, 'v1', ${"b".repeat(64)}, 'reviewed', 'direct write attempt', ${adminUser})
          `),
        ),
      ).rejects.toThrow(/row-level security/);
      // The denied writes changed nothing.
      const stillThere = await inSession(adminUser, orgA, "admin", () => codesStore.getById(sourceId));
      expect(stillThere?.title).toBe("INDOT outdoor advertising sign permits");
    });

    it("ingests through the governed service under the flag and is idempotent", async () => {
      const fetchImpl = (async () =>
        new Response(new TextEncoder().encode("live indot permits bytes"), { status: 200 })) as typeof fetch;
      const input = {
        jurisdictionId: codesJurisdictionId,
        authorityId: codesAuthorityId,
        codeFamily: "sign-permits",
        citation: "INDOT — Governed ingest test",
        title: "INDOT outdoor advertising sign permits",
        sourceUrl: codesSourceUrl,
      };
      const first = await inSession(adminUser, orgA, "admin", () =>
        ingestOfficialCodeSource(codesAdminAuth, input, { fetchImpl }),
      );
      expect(first.outcome).toBe("created");
      expect(first.source.status).toBe("research");
      expect(first.source.versionLabel).toBe("v1");
      const second = await inSession(adminUser, orgA, "admin", () =>
        ingestOfficialCodeSource(codesAdminAuth, input, { fetchImpl }),
      );
      expect(second.outcome).toBe("unchanged");
      expect(second.source.id).toBe(first.source.id);
      const historyCount = await adminClient.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        select count(*)::int as total from codes_source_history where source_id = ${first.source.id}::uuid
      `);
      expect(historyCount[0]?.total).toBe(1);
    });

    it("refuses technician ingest and enforces single human approval", async () => {
      const fetchImpl = (async () =>
        new Response(new TextEncoder().encode("technician attempt bytes"), { status: 200 })) as typeof fetch;
      await expect(
        inSession(technicianUser, orgA, "technician", () =>
          ingestOfficialCodeSource(codesTechnicianAuth, {
            jurisdictionId: codesJurisdictionId,
            authorityId: codesAuthorityId,
            codeFamily: "sign-permits",
            citation: "INDOT — Approval test",
            title: "INDOT outdoor advertising sign permits",
            sourceUrl: "https://www.in.gov/indot/technician-attempt/",
          }, { fetchImpl }),
        ),
      ).rejects.toMatchObject({ statusCode: 403 });

      const created = await inSession(adminUser, orgA, "admin", () =>
        ingestOfficialCodeSource(codesAdminAuth, {
          jurisdictionId: codesJurisdictionId,
          authorityId: codesAuthorityId,
          codeFamily: "sign-permits",
          citation: "INDOT — Approval test",
          title: "INDOT outdoor advertising sign permits",
          sourceUrl: "https://www.in.gov/indot/approval-attempt/",
        }, { fetchImpl }),
      );
      const approved = await inSession(adminUser, orgA, "admin", () =>
        approveCodeSource(codesAdminAuth, created.source.id, {}, {}),
      );
      expect(approved.status).toBe("reviewed");
      expect(approved.reviewedBy).toBe(adminUser);
      await expect(
        inSession(adminUser, orgA, "admin", () => approveCodeSource(codesAdminAuth, created.source.id, {}, {})),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("surfaces expired warnings on live reads", async () => {
      const sourceId = await seedReviewedSource({
        citation: "INDOT — Expired fixture",
        sourceUrl: "https://www.in.gov/indot/expired-source/",
        expiryDate: "2020-01-01",
        sourceHash: "d".repeat(64),
      });
      const read = await inSession(otherUser, orgB, "owner", () => getCodeSource(codesOtherAuth, sourceId, {}));
      expect(read.status).toBe("reviewed");
      expect(read.warnings).toContain("expired");
    });
  });

  // ABC shared catalog, Phase 1 (issue #735). The four catalog tables are
  // org-less reference data: any authenticated org can read, no org can
  // write, and only a transaction that sets the ingestion flag (the
  // Phase 2 importer, run through the background session) can write.
  // Fixtures live only for this block — afterAll removes every row this
  // block created — so no later test sees them. The migration-seeded
  // global ABC Supply supplier row is permanent seed data and is NOT
  // removed here (it is asserted readable, never writable, by tenants).
  describe("abc shared catalog RLS (issue #735, Phase 1)", () => {
    const globalAbcSupplierId = "73500001-0000-4000-8000-000000000001";
    const catalogItemNumber = "ABC-RLS-ITEM-001";
    const catalogItemNumber2 = "ABC-RLS-ITEM-002";
    const catalogHierarchyPath = "PG-RLS/CA-RLS/PT-RLS/MC-RLS/WA-RLS/BL-RLS";
    const catalogHash = "e".repeat(64);
    const catalogHash2 = "f".repeat(64);

    afterAll(async () => {
      await adminClient.abcCatalogSyncState.deleteMany({ where: { id: "abc-catalog" } });
      await adminClient.abcCatalogSyncRun.deleteMany({ where: { correlationId: "rls-phase1-fixture" } });
      await adminClient.abcCatalogHierarchy.deleteMany({ where: { pathKey: catalogHierarchyPath } });
      await adminClient.abcCatalogItem.deleteMany({ where: { itemNumber: { in: [catalogItemNumber, catalogItemNumber2, "ABC-RLS-NODELETE-001"] } } });
    });

    async function seedCatalogItem(itemNumber: string, hash: string): Promise<void> {
      await adminClient.abcCatalogItem.create({
        data: {
          itemNumber,
          description: "RLS fixture item",
          manufacturer: "Fixture Manufacturer",
          familyName: "Fixture Family",
          status: "Active",
          contentHash: hash,
          hierarchyPath: [{ level: "productGroup", code: "PG-RLS", label: "Fixture Group" }],
        },
      });
    }

    async function inCatalogIngestionSession<T>(operation: () => Promise<T>): Promise<T> {
      return runWithBackgroundDatabaseSession(
        appClient,
        { jobName: "abc-catalog-import", orgId: orgA, userId: adminUser },
        async () => {
          await currentTransaction().$queryRaw(
            Prisma.sql`select set_config('app.abc_catalog_ingestion', 'true', true)`,
          );
          return operation();
        },
      );
    }

    it("reads the shared catalog globally: both tenants see the same item, hierarchy, run, and global supplier", async () => {
      await seedCatalogItem(catalogItemNumber, catalogHash);
      await adminClient.abcCatalogHierarchy.create({
        data: {
          pathKey: catalogHierarchyPath,
          level1Code: "PG-RLS",
          level1Label: "Fixture Group",
          levels: [{ level: "productGroup", code: "PG-RLS", label: "Fixture Group" }],
        },
      });
      const run = await adminClient.abcCatalogSyncRun.create({
        data: { kind: "full", status: "succeeded", correlationId: "rls-phase1-fixture" },
      });
      await adminClient.abcCatalogSyncState.create({
        data: { id: "abc-catalog", lastSuccessfulRunId: run.id, lastSeenTotalItems: 1, lastSeenTotalPages: 1 },
      });

      const seenByOrgA = await inSession(adminUser, orgA, "admin", () =>
        currentTransaction().abcCatalogItem.findUnique({ where: { itemNumber: catalogItemNumber } }),
      );
      const seenByOrgB = await inSession(otherUser, orgB, "owner", () =>
        currentTransaction().abcCatalogItem.findUnique({ where: { itemNumber: catalogItemNumber } }),
      );
      expect(seenByOrgA?.itemNumber).toBe(catalogItemNumber);
      expect(seenByOrgB?.itemNumber).toBe(catalogItemNumber);
      expect(seenByOrgB?.description).toBe("RLS fixture item");

      const hierarchyByOrgB = await inSession(otherUser, orgB, "owner", () =>
        currentTransaction().abcCatalogHierarchy.findUnique({ where: { pathKey: catalogHierarchyPath } }),
      );
      expect(hierarchyByOrgB?.pathKey).toBe(catalogHierarchyPath);

      const runByOrgB = await inSession(otherUser, orgB, "owner", () =>
        currentTransaction().abcCatalogSyncRun.findUnique({ where: { id: run.id } }),
      );
      expect(runByOrgB?.correlationId).toBe("rls-phase1-fixture");

      const stateByOrgB = await inSession(otherUser, orgB, "owner", () =>
        currentTransaction().abcCatalogSyncState.findUnique({ where: { id: "abc-catalog" } }),
      );
      expect(stateByOrgB?.lastSuccessfulRunId).toBe(run.id);

      // The global ABC Supply supplier row is readable by both orgs.
      const supplierByOrgA = await inSession(adminUser, orgA, "admin", () =>
        currentTransaction().supplier.findUnique({ where: { id: globalAbcSupplierId } }),
      );
      const supplierByOrgB = await inSession(otherUser, orgB, "owner", () =>
        currentTransaction().supplier.findUnique({ where: { id: globalAbcSupplierId } }),
      );
      expect(supplierByOrgA).toMatchObject({ orgId: null, name: "ABC Supply", apiIntegrationKey: "ABC_SUPPLY" });
      expect(supplierByOrgB).toMatchObject({ orgId: null, name: "ABC Supply", apiIntegrationKey: "ABC_SUPPLY" });
    });

    it("denies direct tenant writes without the ingestion flag", async () => {
      await seedCatalogItem(catalogItemNumber2, catalogHash2);
      await expect(
        inSession(adminUser, orgA, "admin", () =>
          currentTransaction().$queryRaw(Prisma.sql`
            insert into abc_catalog_items (item_number, description, status, content_hash)
            values ('ABC-RLS-DIRECT', 'direct write attempt', 'Active', ${"a".repeat(64)})
          `),
        ),
      ).rejects.toThrow(/row-level security/);
      // UPDATE/DELETE under RLS do NOT throw: a row the session's policy
      // hides is silently skipped, so the denial is proven by effect —
      // zero rows affected — not by an error (same split as the
      // codes_source test above).
      const updated = await inSession(adminUser, orgA, "admin", () =>
        currentTransaction().$executeRaw(Prisma.sql`
          update abc_catalog_items set description = 'direct edit' where item_number = ${catalogItemNumber2}
        `),
      );
      expect(updated).toBe(0);
      const deleted = await inSession(adminUser, orgA, "admin", () =>
        currentTransaction().$executeRaw(Prisma.sql`
          delete from abc_catalog_items where item_number = ${catalogItemNumber2}
        `),
      );
      expect(deleted).toBe(0);
      await expect(
        inSession(adminUser, orgA, "admin", () =>
          currentTransaction().$queryRaw(Prisma.sql`
            insert into abc_catalog_hierarchy (path_key, levels)
            values ('DIRECT/WRITE/ATTEMPT', '[]'::jsonb)
          `),
        ),
      ).rejects.toThrow(/row-level security/);
      await expect(
        inSession(adminUser, orgA, "admin", () =>
          currentTransaction().$queryRaw(Prisma.sql`
            insert into abc_catalog_sync_runs (kind, status) values ('full', 'running')
          `),
        ),
      ).rejects.toThrow(/row-level security/);
      // The denied writes changed nothing.
      const stillThere = await inSession(otherUser, orgB, "owner", () =>
        currentTransaction().abcCatalogItem.findUnique({ where: { itemNumber: catalogItemNumber2 } }),
      );
      expect(stillThere?.description).toBe("RLS fixture item");

      // The global supplier row is read-only to tenants: an org admin
      // cannot update it (org_id NULL never matches the session org).
      const supplierUpdated = await inSession(adminUser, orgA, "admin", () =>
        currentTransaction().$executeRaw(Prisma.sql`
          update suppliers set name = 'Tenant edit' where id = ${globalAbcSupplierId}::uuid
        `),
      );
      expect(supplierUpdated).toBe(0);
      const supplierStillThere = await inSession(otherUser, orgB, "owner", () =>
        currentTransaction().supplier.findUnique({ where: { id: globalAbcSupplierId } }),
      );
      expect(supplierStillThere?.name).toBe("ABC Supply");
    });

    it("allows writes under the ingestion flag inside a background session", async () => {
      const run = await inCatalogIngestionSession(() =>
        currentTransaction().abcCatalogSyncRun.create({
          data: { kind: "delta", status: "running", correlationId: "rls-phase1-fixture" },
        }),
      );
      expect(run.kind).toBe("delta");
      const item = await inCatalogIngestionSession(() =>
        currentTransaction().abcCatalogItem.create({
          data: {
            itemNumber: "ABC-RLS-INGEST-001",
            description: "Ingested item",
            manufacturer: "Ingest Manufacturer",
            status: "Active",
            contentHash: "b".repeat(64),
          },
        }),
      );
      expect(item.itemNumber).toBe("ABC-RLS-INGEST-001");
      await inCatalogIngestionSession(() =>
        currentTransaction().abcCatalogItem.update({
          where: { itemNumber: "ABC-RLS-INGEST-001" },
          data: { description: "Ingested item (updated)" },
        }),
      );
      // The ingested row is immediately visible to an ordinary tenant read.
      const seenByOrgB = await inSession(otherUser, orgB, "owner", () =>
        currentTransaction().abcCatalogItem.findUnique({ where: { itemNumber: "ABC-RLS-INGEST-001" } }),
      );
      expect(seenByOrgB?.description).toBe("Ingested item (updated)");
      // Cleanup for the rows this test created (the block afterAll only
      // covers the named fixtures).
      await adminClient.abcCatalogItem.delete({ where: { itemNumber: "ABC-RLS-INGEST-001" } });
      await adminClient.abcCatalogSyncRun.delete({ where: { id: run.id } });
    });

    it("denies deletes even under the ingestion flag: catalog rows are soft-deactivated, never hard-deleted", async () => {
      await seedCatalogItem("ABC-RLS-NODELETE-001", "c".repeat(64));
      const deleted = await inCatalogIngestionSession(() =>
        currentTransaction().$executeRaw(Prisma.sql`
          delete from abc_catalog_items where item_number = 'ABC-RLS-NODELETE-001'
        `),
      );
      expect(deleted).toBe(0);
      const stillThere = await inSession(adminUser, orgA, "admin", () =>
        currentTransaction().abcCatalogItem.findUnique({ where: { itemNumber: "ABC-RLS-NODELETE-001" } }),
      );
      expect(stillThere?.itemNumber).toBe("ABC-RLS-NODELETE-001");
    });
  });

  // DES-10-F8: live RLS coverage for proposal_selections and
  // proposal_allowances. The migration tests only inspect SQL strings and
  // the service tests mock Prisma, so neither proves tenant isolation,
  // portal customer isolation, or role-based write denial against a real
  // database. A second orgA customer (customerA2) proves portal isolation
  // *within* one org, not just across orgs. Fixtures live only for this
  // block — afterAll removes every row — so no later test sees the extra
  // project, and this block runs last in the file for the same reason.
  describe("proposal selections and allowances RLS (DES-10-F8)", () => {
    const customerA2 = "10000000-0000-0000-0000-000000000220";
    const projectA2 = "10000000-0000-0000-0000-000000000221";
    const proposalA = "10000000-0000-0000-0000-000000000222";
    const proposalA2 = "10000000-0000-0000-0000-000000000223";
    const proposalB = "20000000-0000-0000-0000-000000000224";
    const selectionA = "10000000-0000-0000-0000-000000000225";
    const selectionA2 = "10000000-0000-0000-0000-000000000226";
    const selectionB = "20000000-0000-0000-0000-000000000227";
    const allowanceA = "10000000-0000-0000-0000-000000000228";
    const allowanceA2 = "10000000-0000-0000-0000-000000000229";
    const allowanceB = "20000000-0000-0000-0000-000000000230";
    const portalSessionId = "10000000-0000-0000-0000-000000000231";

    beforeAll(async () => {
      await adminClient.customer.create({
        data: { id: customerA2, orgId: orgA, name: "Org A Second Customer", email: "orga2@example.com" },
      });
      await adminClient.project.create({
        data: { id: projectA2, orgId: orgA, customerId: customerA2, name: "Org A Second Project" },
      });
      await adminClient.proposal.createMany({
        data: [
          { id: proposalA, projectId: projectA, status: "draft" },
          { id: proposalA2, projectId: projectA2, status: "draft" },
          { id: proposalB, projectId: projectB, status: "draft" },
        ],
      });
      await adminClient.proposalSelection.createMany({
        data: [
          { id: selectionA, orgId: orgA, proposalId: proposalA, label: "PENDANTS" },
          { id: selectionA2, orgId: orgA, proposalId: proposalA2, label: "CABINET FINISH" },
          { id: selectionB, orgId: orgB, proposalId: proposalB, label: "COUNTERTOP" },
        ],
      });
      await adminClient.proposalAllowance.createMany({
        data: [
          { id: allowanceA, orgId: orgA, proposalId: proposalA, description: "PENDANT LIGHTING", amount: 1200 },
          { id: allowanceA2, orgId: orgA, proposalId: proposalA2, description: "CABINET HARDWARE", amount: 1600 },
          { id: allowanceB, orgId: orgB, proposalId: proposalB, description: "RANGE HOOD", amount: 900 },
        ],
      });
    });

    afterAll(async () => {
      await adminClient.proposalSelection.deleteMany({ where: { id: { in: [selectionA, selectionA2, selectionB] } } });
      await adminClient.proposalAllowance.deleteMany({ where: { id: { in: [allowanceA, allowanceA2, allowanceB] } } });
      await adminClient.proposal.deleteMany({ where: { id: { in: [proposalA, proposalA2, proposalB] } } });
      await adminClient.project.delete({ where: { id: projectA2 } });
      await adminClient.customer.delete({ where: { id: customerA2 } });
    });

    it("isolates selections and allowances by tenant for staff reads and writes", async () => {
      const visibleSelections = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().proposalSelection.findMany({ where: { proposalId: proposalA }, orderBy: { id: "asc" } })
      );
      expect(visibleSelections.map((row) => row.id)).toEqual([selectionA]);

      const crossOrgSelections = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().proposalSelection.findMany({ where: { proposalId: proposalA } })
      );
      expect(crossOrgSelections).toEqual([]);
      const crossOrgLookup = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().proposalSelection.findUnique({ where: { id: selectionA } })
      );
      expect(crossOrgLookup).toBeNull();

      const visibleAllowances = await inSession(adminUser, orgA, "admin", async () =>
        currentTransaction().proposalAllowance.findMany({ where: { proposalId: proposalA } })
      );
      expect(visibleAllowances.map((row) => row.id)).toEqual([allowanceA]);
      const crossOrgAllowance = await inSession(otherUser, orgB, "owner", async () =>
        currentTransaction().proposalAllowance.findUnique({ where: { id: allowanceA } })
      );
      expect(crossOrgAllowance).toBeNull();

      // Same-org staff write through the service; a cross-org service call
      // cannot see the parent proposal at all.
      const created = await inSession(adminUser, orgA, "admin", async () =>
        new ProposalsService().createSelection(proposalA, { label: "COUNTERTOP" }, orgA)
      );
      expect(created.proposalId).toBe(proposalA);
      await inSession(adminUser, orgA, "admin", async () =>
        new ProposalsService().deleteSelection(created.id, proposalA, orgA)
      );
      await expect(
        inSession(otherUser, orgB, "owner", async () =>
          new ProposalsService().createSelection(proposalA, { label: "COUNTERTOP" }, orgB)
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("scopes portal customer reads to the verified customer's own proposals", async () => {
      const portal = (customerId: string, accessTokenId: string) => ({
        sessionId: portalSessionId,
        accessTokenId,
        orgId: orgA,
        customerId,
      });

      const customerAView = await runWithPortalDatabaseSession(
        appClient,
        portal(customerA, "10000000-0000-0000-0000-000000000232"),
        async () => ({
          selections: await currentTransaction().proposalSelection.findMany({ orderBy: { id: "asc" } }),
          allowances: await currentTransaction().proposalAllowance.findMany({ orderBy: { id: "asc" } }),
          foreignSelection: await currentTransaction().proposalSelection.findUnique({ where: { id: selectionA2 } }),
          foreignAllowance: await currentTransaction().proposalAllowance.findUnique({ where: { id: allowanceA2 } }),
        })
      );
      expect(customerAView.selections.map((row) => row.id)).toEqual([selectionA]);
      expect(customerAView.allowances.map((row) => row.id)).toEqual([allowanceA]);
      expect(customerAView.foreignSelection).toBeNull();
      expect(customerAView.foreignAllowance).toBeNull();

      // Same org, different customer: sees only its own proposal's rows.
      const customerA2View = await runWithPortalDatabaseSession(
        appClient,
        portal(customerA2, "10000000-0000-0000-0000-000000000233"),
        async () => ({
          selections: await currentTransaction().proposalSelection.findMany({ orderBy: { id: "asc" } }),
          allowances: await currentTransaction().proposalAllowance.findMany({ orderBy: { id: "asc" } }),
        })
      );
      expect(customerA2View.selections.map((row) => row.id)).toEqual([selectionA2]);
      expect(customerA2View.allowances.map((row) => row.id)).toEqual([allowanceA2]);
    });

    it("denies selections and allowances writes to viewers and portal customers at the database boundary", async () => {
      // Viewers can read the org's rows but cannot write them: the write
      // policy requires current_app_can_write().
      await expect(
        inSession(viewerUser, orgA, "viewer", async () =>
          currentTransaction().proposalSelection.create({
            data: { orgId: orgA, proposalId: proposalA, label: "PENDANTS" },
          })
        )
      ).rejects.toThrow();
      await expect(
        inSession(viewerUser, orgA, "viewer", async () =>
          new ProposalsService().createAllowance(proposalA, { description: "PENDANT LIGHTING", amount: 100 }, orgA)
        )
      ).rejects.toThrow();

      // A portal customer cannot write either, even to its own proposal's rows.
      await expect(
        runWithPortalDatabaseSession(
          appClient,
          { sessionId: portalSessionId, accessTokenId: "10000000-0000-0000-0000-000000000234", orgId: orgA, customerId: customerA },
          async () =>
            currentTransaction().proposalAllowance.create({
              data: { orgId: orgA, proposalId: proposalA, description: "PENDANT LIGHTING", amount: 100 },
            })
        )
      ).rejects.toThrow();

      // The denied writes changed nothing.
      const counts = await inSession(adminUser, orgA, "admin", async () => ({
        selections: await currentTransaction().proposalSelection.count({ where: { proposalId: proposalA } }),
        allowances: await currentTransaction().proposalAllowance.count({ where: { proposalId: proposalA } }),
      }));
      expect(counts).toEqual({ selections: 1, allowances: 1 });
    });
  });

  describe("closeout and warranty workspace RLS (S069)", () => {
    it("enforces closeout and warranty tenant boundaries", async () => {
      // S069 tables carry a direct org_id with forced RLS
      // (20261124120000_add_closeout_warranty_workspace): org-scoped reads
      // for every role; writes are owner/admin/estimator (via
      // current_app_can_write()) plus dispatcher; punch-item updates add
      // the one field-staff carve-out — the assigned technician may update
      // only the punch item assigned to them. The RLS assertions below go
      // through the request-scoped session (inSession /
      // currentTransaction), never through mocked Prisma; the admin client
      // only seeds fixtures and cleans up.
      const punchA = randomUUID();
      const punchB = randomUUID();
      const punchUnassigned = randomUUID();
      const punchViewerAssigned = randomUUID();
      const closeoutA = randomUUID();
      const closeoutB = randomUUID();
      const warrantyA = randomUUID();
      const warrantyB = randomUUID();
      const warrantyForeignProject = randomUUID();
      const punchForeignProject = randomUUID();
      const proposalB = randomUUID();
      const contractB = randomUUID();
      const invoiceB = randomUUID();
      const dispatcherUser = randomUUID();
      const dispatcherMembership = randomUUID();
      await adminClient.punchItem.createMany({
        data: [
          { id: punchA, orgId: orgA, projectId: projectA, jobId: jobA, title: "Touch up paint at entry trim", status: "open", priority: "high", assignedUserId: technicianUser, createdById: adminUser },
          { id: punchB, orgId: orgB, projectId: projectB, title: "Foreign punch item", status: "open", createdById: otherUser },
          { id: punchUnassigned, orgId: orgA, projectId: projectA, jobId: jobA, title: "Unassigned punch item", status: "open", createdById: adminUser },
          { id: punchViewerAssigned, orgId: orgA, projectId: projectA, jobId: jobA, title: "Viewer-assigned punch item", status: "open", assignedUserId: viewerUser, createdById: adminUser },
        ],
      });
      // Foreign-parent fixtures for the parent-ownership checks: a project,
      // job, contract, and invoice that all belong to orgB.
      await adminClient.proposal.create({
        data: { id: proposalB, projectId: projectB, status: "sent", finalPrice: 100, priceLow: 90, priceHigh: 110 },
      });
      await adminClient.contract.create({
        data: { id: contractB, projectId: projectB, proposalId: proposalB, status: "pending_signature", termsText: "Foreign contract" },
      });
      await adminClient.invoice.create({
        data: { id: invoiceB, projectId: projectB, proposalId: proposalB, invoiceNumber: 991, status: "sent", amount: 100 },
      });
      await adminClient.punchItem.create({
        data: { id: punchForeignProject, orgId: orgA, projectId: projectB, title: "Own-org punch on a foreign project", status: "open", createdById: adminUser },
      });
      await adminClient.projectCloseout.createMany({
        data: [
          { id: closeoutA, orgId: orgA, projectId: projectA, jobId: jobA, status: "draft" },
          { id: closeoutB, orgId: orgB, projectId: projectB, status: "draft" },
        ],
      });
      await adminClient.warrantyRecord.createMany({
        data: [
          { id: warrantyA, orgId: orgA, projectId: projectA, jobId: jobA, title: "Workmanship warranty", coverageText: "One-year workmanship coverage per the signed contract.", sourceType: "other", createdById: adminUser },
          { id: warrantyB, orgId: orgB, projectId: projectB, title: "Foreign warranty", coverageText: "Foreign coverage.", sourceType: "other", createdById: otherUser },
          { id: warrantyForeignProject, orgId: orgA, projectId: projectB, title: "Own-org warranty on a foreign project", coverageText: "Foreign-project coverage.", sourceType: "other", createdById: adminUser },
        ],
      });
      await adminClient.appUser.create({
        data: { id: dispatcherUser, authSubject: "rls-s069-dispatcher", email: "rls-s069-dispatcher@example.com" },
      });
      await adminClient.organizationMembership.create({
        data: { id: dispatcherMembership, orgId: orgA, userId: dispatcherUser, role: "dispatcher", status: "active" },
      });
      try {
        // Same-org reads are allowed on all three tables, for every role:
        // the select policies are org-scoped, not assignment-scoped.
        const visiblePunch = await inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().punchItem.findMany({ where: { projectId: projectA } }),
        );
        expect(visiblePunch.map((row) => row.id).sort()).toEqual([punchA, punchUnassigned, punchViewerAssigned].sort());
        const visibleCloseout = await inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().projectCloseout.findUnique({ where: { id: closeoutA } }),
        );
        expect(visibleCloseout?.id).toBe(closeoutA);
        const visibleWarranty = await inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().warrantyRecord.findUnique({ where: { id: warrantyA } }),
        );
        expect(visibleWarranty?.id).toBe(warrantyA);
        const technicianVisible = await inSession(technicianUser, orgA, "technician", async () =>
          currentTransaction().punchItem.findUnique({ where: { id: punchA } }),
        );
        expect(technicianVisible?.id).toBe(punchA);

        // Cross-org reads are hidden on all three tables.
        const hiddenPunch = await inSession(otherUser, orgB, "owner", async () =>
          currentTransaction().punchItem.findUnique({ where: { id: punchA } }),
        );
        expect(hiddenPunch).toBeNull();
        const hiddenCloseout = await inSession(otherUser, orgB, "owner", async () =>
          currentTransaction().projectCloseout.findUnique({ where: { id: closeoutA } }),
        );
        expect(hiddenCloseout).toBeNull();
        const hiddenWarranty = await inSession(otherUser, orgB, "owner", async () =>
          currentTransaction().warrantyRecord.findUnique({ where: { id: warrantyA } }),
        );
        expect(hiddenWarranty).toBeNull();
        const foreignOnly = await inSession(otherUser, orgB, "owner", async () =>
          currentTransaction().punchItem.findMany(),
        );
        expect(foreignOnly.map((row) => row.id)).toEqual([punchB]);

        // Cross-org writes are denied even with a matching org_id claim.
        await expect(
          inSession(otherUser, orgB, "owner", async () =>
            currentTransaction().punchItem.create({
              data: { orgId: orgA, projectId: projectA, title: "Cross-org punch item", createdById: otherUser },
            }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(otherUser, orgB, "owner", async () =>
            currentTransaction().punchItem.update({ where: { id: punchA }, data: { status: "resolved" } }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(otherUser, orgB, "owner", async () =>
            currentTransaction().projectCloseout.update({ where: { id: closeoutA }, data: { status: "ready" } }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(otherUser, orgB, "owner", async () =>
            currentTransaction().warrantyRecord.delete({ where: { id: warrantyA } }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(otherUser, orgB, "owner", async () =>
            currentTransaction().warrantyRecord.create({
              data: { orgId: orgA, projectId: projectA, title: "Cross-org warranty", coverageText: "Cross-org coverage.", sourceType: "other", createdById: otherUser },
            }),
          ),
        ).rejects.toThrow();

        // Viewers may read their own org's rows but cannot write them.
        await expect(
          inSession(viewerUser, orgA, "viewer", async () =>
            currentTransaction().punchItem.create({
              data: { orgId: orgA, projectId: projectA, title: "Viewer punch item", createdById: viewerUser },
            }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(viewerUser, orgA, "viewer", async () =>
            currentTransaction().projectCloseout.update({ where: { id: closeoutA }, data: { notes: "Viewer note" } }),
          ),
        ).rejects.toThrow();

        // Technicians cannot insert punch items or write closeouts /
        // warranties at all — their only write is the assigned-punch
        // carve-out below.
        await expect(
          inSession(technicianUser, orgA, "technician", async () =>
            currentTransaction().punchItem.create({
              data: { orgId: orgA, projectId: projectA, title: "Technician punch item", createdById: technicianUser },
            }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(technicianUser, orgA, "technician", async () =>
            currentTransaction().projectCloseout.update({ where: { id: closeoutA }, data: { status: "ready" } }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(technicianUser, orgA, "technician", async () =>
            currentTransaction().warrantyRecord.update({ where: { id: warrantyA }, data: { title: "Technician edit" } }),
          ),
        ).rejects.toThrow();

        // The assigned technician may update only their assigned punch item.
        const resolved = await inSession(technicianUser, orgA, "technician", async () =>
          currentTransaction().punchItem.update({ where: { id: punchA }, data: { status: "in_progress" } }),
        );
        expect(resolved.status).toBe("in_progress");
        // …but not a punch item assigned to someone else (or no one).
        await expect(
          inSession(technicianUser, orgA, "technician", async () =>
            currentTransaction().punchItem.update({ where: { id: punchUnassigned }, data: { status: "in_progress" } }),
          ),
        ).rejects.toThrow();
        const untouched = await adminClient.punchItem.findUniqueOrThrow({ where: { id: punchUnassigned } });
        expect(untouched.status).toBe("open");

        // The assignee carve-out is technician-only: a viewer assigned to a
        // punch item still cannot update it.
        await expect(
          inSession(viewerUser, orgA, "viewer", async () =>
            currentTransaction().punchItem.update({ where: { id: punchViewerAssigned }, data: { status: "in_progress" } }),
          ),
        ).rejects.toThrow();
        const viewerAssignedUntouched = await adminClient.punchItem.findUniqueOrThrow({ where: { id: punchViewerAssigned } });
        expect(viewerAssignedUntouched.status).toBe("open");

        // Parent ownership: a row carrying the caller's org_id but a foreign
        // project_id is denied — the foreign-key check bypasses RLS, so
        // org_id alone cannot prove the parent belongs to the caller.
        await expect(
          inSession(adminUser, orgA, "admin", async () =>
            currentTransaction().projectCloseout.create({
              data: { orgId: orgA, projectId: projectB, status: "draft" },
            }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(adminUser, orgA, "admin", async () =>
            currentTransaction().warrantyRecord.create({
              data: { orgId: orgA, projectId: projectB, title: "Foreign-project warranty", coverageText: "Coverage.", sourceType: "other", createdById: adminUser },
            }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(adminUser, orgA, "admin", async () =>
            currentTransaction().punchItem.create({
              data: { orgId: orgA, projectId: projectB, title: "Foreign-project punch item", createdById: adminUser },
            }),
          ),
        ).rejects.toThrow();
        // The same parent check applies to each optional reference: a
        // foreign job, contract, or invoice denies the write even when the
        // project itself belongs to the caller.
        await expect(
          inSession(adminUser, orgA, "admin", async () =>
            currentTransaction().punchItem.create({
              data: { orgId: orgA, projectId: projectA, jobId: jobB, title: "Foreign-job punch item", createdById: adminUser },
            }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(adminUser, orgA, "admin", async () =>
            currentTransaction().warrantyRecord.create({
              data: { orgId: orgA, projectId: projectA, jobId: jobB, title: "Foreign-job warranty", coverageText: "Coverage.", sourceType: "other", createdById: adminUser },
            }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(adminUser, orgA, "admin", async () =>
            currentTransaction().warrantyRecord.create({
              data: { orgId: orgA, projectId: projectA, contractId: contractB, title: "Foreign-contract warranty", coverageText: "Coverage.", sourceType: "contract", createdById: adminUser },
            }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(adminUser, orgA, "admin", async () =>
            currentTransaction().warrantyRecord.create({
              data: { orgId: orgA, projectId: projectA, invoiceId: invoiceB, title: "Foreign-invoice warranty", coverageText: "Coverage.", sourceType: "invoice", createdById: adminUser },
            }),
          ),
        ).rejects.toThrow();
        // UPDATE is gated the same way: a row seeded with a foreign parent
        // cannot be updated even by the owning org's admin, and moving a
        // closeout onto a foreign job is denied by WITH CHECK.
        await expect(
          inSession(adminUser, orgA, "admin", async () =>
            currentTransaction().punchItem.update({ where: { id: punchForeignProject }, data: { title: "Edited" } }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(adminUser, orgA, "admin", async () =>
            currentTransaction().warrantyRecord.update({ where: { id: warrantyForeignProject }, data: { title: "Edited" } }),
          ),
        ).rejects.toThrow();
        await expect(
          inSession(adminUser, orgA, "admin", async () =>
            currentTransaction().projectCloseout.update({ where: { id: closeoutA }, data: { jobId: jobB } }),
          ),
        ).rejects.toThrow();
        expect((await adminClient.punchItem.findUniqueOrThrow({ where: { id: punchForeignProject } })).title).toBe(
          "Own-org punch on a foreign project",
        );
        expect((await adminClient.warrantyRecord.findUniqueOrThrow({ where: { id: warrantyForeignProject } })).title).toBe(
          "Own-org warranty on a foreign project",
        );
        expect((await adminClient.projectCloseout.findUniqueOrThrow({ where: { id: closeoutA } })).jobId).toBe(jobA);

        // Dispatcher writes are allowed on all three tables: the closeout
        // manager role holds crm.write in app/domain/contracts.ts, and
        // the S069 policies name dispatcher explicitly because
        // current_app_can_write() (owner/admin/estimator) would deny it.
        const dispatcherPunch = await inSession(dispatcherUser, orgA, "dispatcher", async () =>
          currentTransaction().punchItem.create({
            data: { orgId: orgA, projectId: projectA, jobId: jobA, title: "Dispatcher punch item", createdById: dispatcherUser },
          }),
        );
        expect(dispatcherPunch.orgId).toBe(orgA);
        const dispatcherCloseout = await inSession(dispatcherUser, orgA, "dispatcher", async () =>
          currentTransaction().projectCloseout.update({ where: { id: closeoutA }, data: { notes: "Dispatcher note" } }),
        );
        expect(dispatcherCloseout.notes).toBe("Dispatcher note");
        const dispatcherWarranty = await inSession(dispatcherUser, orgA, "dispatcher", async () =>
          currentTransaction().warrantyRecord.create({
            data: { orgId: orgA, projectId: projectA, title: "Dispatcher warranty", coverageText: "Dispatcher coverage.", sourceType: "other", createdById: dispatcherUser },
          }),
        );
        expect(dispatcherWarranty.orgId).toBe(orgA);
        const dispatcherDeleted = await inSession(dispatcherUser, orgA, "dispatcher", async () =>
          currentTransaction().punchItem.delete({ where: { id: dispatcherPunch.id } }),
        );
        expect(dispatcherDeleted.id).toBe(dispatcherPunch.id);
        await adminClient.warrantyRecord.delete({ where: { id: dispatcherWarranty.id } });

        // The denied writes changed nothing.
        const counts = await inSession(adminUser, orgA, "admin", async () => ({
          punchItems: await currentTransaction().punchItem.count({ where: { projectId: projectA } }),
          closeouts: await currentTransaction().projectCloseout.count({ where: { projectId: projectA } }),
          warranties: await currentTransaction().warrantyRecord.count({ where: { projectId: projectA } }),
        }));
        expect(counts).toEqual({ punchItems: 3, closeouts: 1, warranties: 1 });
        const closeoutAfter = await adminClient.projectCloseout.findUniqueOrThrow({ where: { id: closeoutA } });
        expect(closeoutAfter.status).toBe("draft");
      } finally {
        await adminClient.warrantyRecord.deleteMany({ where: { id: { in: [warrantyA, warrantyB, warrantyForeignProject] } } });
        await adminClient.projectCloseout.deleteMany({ where: { id: { in: [closeoutA, closeoutB] } } });
        await adminClient.punchItem.deleteMany({ where: { id: { in: [punchA, punchB, punchUnassigned, punchViewerAssigned, punchForeignProject] } } });
        await adminClient.invoice.deleteMany({ where: { id: invoiceB } });
        await adminClient.contract.deleteMany({ where: { id: contractB } });
        await adminClient.proposal.deleteMany({ where: { id: proposalB } });
        await adminClient.organizationMembership.deleteMany({ where: { id: dispatcherMembership } });
        await adminClient.appUser.deleteMany({ where: { id: dispatcherUser } });
      }
    });

    it("scopes portal customer reads to the verified customer's own closeout rows and completed jobs", async () => {
      // Same organization, two customers: the portal session of one must
      // never see the other's punch items, closeouts, warranties, or
      // completed jobs (S069 restrictive portal-scope policies +
      // app_completed_job_ids_for_project). Fixtures live only for this
      // test — the first test in this describe already cleaned its own.
      const siblingCustomer = randomUUID();
      const siblingProject = randomUUID();
      const siblingAddress = randomUUID();
      const ownPunch = randomUUID();
      const siblingPunch = randomUUID();
      const ownCloseout = randomUUID();
      const siblingCloseout = randomUUID();
      const ownWarranty = randomUUID();
      const siblingWarranty = randomUUID();
      const ownCompletedJob = randomUUID();
      const siblingCompletedJob = randomUUID();
      const portal = (customerId: string) => ({
        sessionId: randomUUID(),
        accessTokenId: randomUUID(),
        orgId: orgA,
        customerId,
      });
      const probe = (projectId: string) =>
        currentTransaction().$queryRaw<Array<{ job_ids: string[] }>>(
          Prisma.sql`SELECT public.app_completed_job_ids_for_project(${projectId}::uuid) AS job_ids`,
        );
      try {
        await adminClient.customer.create({
          data: { id: siblingCustomer, orgId: orgA, name: "Org A Sibling Customer", email: "orga-sibling@example.com" },
        });
        await adminClient.serviceAddress.create({
          data: {
            id: siblingAddress,
            orgId: orgA,
            customerId: siblingCustomer,
            addressLine1: "2 S069 Way",
            city: "Terre Haute",
            state: "IN",
            postalCode: "47802",
          },
        });
        await adminClient.project.create({
          data: { id: siblingProject, orgId: orgA, customerId: siblingCustomer, name: "Org A Sibling Project" },
        });
        await adminClient.job.createMany({
          data: [
            {
              id: ownCompletedJob,
              orgId: orgA,
              projectId: projectA,
              customerId: customerA,
              serviceAddressId: serviceAddressA,
              jobNumber: "JOB-2026-000069-PORTAL",
              title: "Org A Completed Job",
              jobType: "General Contracting",
              status: "completed",
              completedAt: new Date("2026-11-21T15:00:00.000Z"),
              createdById: adminUser,
            },
            {
              id: siblingCompletedJob,
              orgId: orgA,
              projectId: siblingProject,
              customerId: siblingCustomer,
              serviceAddressId: siblingAddress,
              jobNumber: "JOB-2026-000069-SIBLING",
              title: "Sibling Completed Job",
              jobType: "General Contracting",
              status: "completed",
              completedAt: new Date("2026-11-21T16:00:00.000Z"),
              createdById: adminUser,
            },
          ],
        });
        await adminClient.punchItem.createMany({
          data: [
            { id: ownPunch, orgId: orgA, projectId: projectA, title: "Own punch item", status: "open", createdById: adminUser },
            { id: siblingPunch, orgId: orgA, projectId: siblingProject, title: "Sibling punch item", status: "open", createdById: adminUser },
          ],
        });
        await adminClient.projectCloseout.createMany({
          data: [
            { id: ownCloseout, orgId: orgA, projectId: projectA, status: "draft" },
            { id: siblingCloseout, orgId: orgA, projectId: siblingProject, status: "draft" },
          ],
        });
        await adminClient.warrantyRecord.createMany({
          data: [
            { id: ownWarranty, orgId: orgA, projectId: projectA, title: "Own warranty", coverageText: "Own coverage.", sourceType: "other", createdById: adminUser },
            { id: siblingWarranty, orgId: orgA, projectId: siblingProject, title: "Sibling warranty", coverageText: "Sibling coverage.", sourceType: "other", createdById: adminUser },
          ],
        });

        const ownView = await runWithPortalDatabaseSession(appClient, portal(customerA), async () => ({
          punches: await currentTransaction().punchItem.findMany({ orderBy: { id: "asc" } }),
          closeouts: await currentTransaction().projectCloseout.findMany({ orderBy: { id: "asc" } }),
          warranties: await currentTransaction().warrantyRecord.findMany({ orderBy: { id: "asc" } }),
          foreignPunch: await currentTransaction().punchItem.findUnique({ where: { id: siblingPunch } }),
          foreignCloseout: await currentTransaction().projectCloseout.findUnique({ where: { id: siblingCloseout } }),
          foreignWarranty: await currentTransaction().warrantyRecord.findUnique({ where: { id: siblingWarranty } }),
          ownCompletedJobs: await probe(projectA),
          foreignCompletedJobs: await probe(siblingProject),
        }));
        expect(ownView.punches.map((row) => row.id)).toEqual([ownPunch]);
        expect(ownView.closeouts.map((row) => row.id)).toEqual([ownCloseout]);
        expect(ownView.warranties.map((row) => row.id)).toEqual([ownWarranty]);
        expect(ownView.foreignPunch).toBeNull();
        expect(ownView.foreignCloseout).toBeNull();
        expect(ownView.foreignWarranty).toBeNull();
        expect(ownView.ownCompletedJobs).toEqual([{ job_ids: [ownCompletedJob] }]);
        expect(ownView.foreignCompletedJobs).toEqual([{ job_ids: [] }]);

        const siblingView = await runWithPortalDatabaseSession(appClient, portal(siblingCustomer), async () => ({
          punches: await currentTransaction().punchItem.findMany({ orderBy: { id: "asc" } }),
          closeouts: await currentTransaction().projectCloseout.findMany({ orderBy: { id: "asc" } }),
          warranties: await currentTransaction().warrantyRecord.findMany({ orderBy: { id: "asc" } }),
          foreignPunch: await currentTransaction().punchItem.findUnique({ where: { id: ownPunch } }),
          foreignCloseout: await currentTransaction().projectCloseout.findUnique({ where: { id: ownCloseout } }),
          foreignWarranty: await currentTransaction().warrantyRecord.findUnique({ where: { id: ownWarranty } }),
          ownCompletedJobs: await probe(siblingProject),
          foreignCompletedJobs: await probe(projectA),
        }));
        expect(siblingView.punches.map((row) => row.id)).toEqual([siblingPunch]);
        expect(siblingView.closeouts.map((row) => row.id)).toEqual([siblingCloseout]);
        expect(siblingView.warranties.map((row) => row.id)).toEqual([siblingWarranty]);
        expect(siblingView.foreignPunch).toBeNull();
        expect(siblingView.foreignCloseout).toBeNull();
        expect(siblingView.foreignWarranty).toBeNull();
        expect(siblingView.ownCompletedJobs).toEqual([{ job_ids: [siblingCompletedJob] }]);
        expect(siblingView.foreignCompletedJobs).toEqual([{ job_ids: [] }]);

        // Staff reads are unchanged: an admin still sees both customers'
        // rows in the org (the restrictive policies pass trivially for
        // non-portal roles).
        const staffView = await inSession(adminUser, orgA, "admin", async () => ({
          punches: await currentTransaction().punchItem.findMany({ orderBy: { id: "asc" } }),
          closeouts: await currentTransaction().projectCloseout.findMany({ orderBy: { id: "asc" } }),
          warranties: await currentTransaction().warrantyRecord.findMany({ orderBy: { id: "asc" } }),
        }));
        expect(staffView.punches.map((row) => row.id).sort()).toEqual([ownPunch, siblingPunch].sort());
        expect(staffView.closeouts.map((row) => row.id).sort()).toEqual([ownCloseout, siblingCloseout].sort());
        expect(staffView.warranties.map((row) => row.id).sort()).toEqual([ownWarranty, siblingWarranty].sort());
      } finally {
        await adminClient.warrantyRecord.deleteMany({ where: { id: { in: [ownWarranty, siblingWarranty] } } });
        await adminClient.projectCloseout.deleteMany({ where: { id: { in: [ownCloseout, siblingCloseout] } } });
        await adminClient.punchItem.deleteMany({ where: { id: { in: [ownPunch, siblingPunch] } } });
        await adminClient.job.deleteMany({ where: { id: { in: [ownCompletedJob, siblingCompletedJob] } } });
        await adminClient.project.deleteMany({ where: { id: siblingProject } });
        await adminClient.serviceAddress.deleteMany({ where: { id: siblingAddress } });
        await adminClient.customer.deleteMany({ where: { id: siblingCustomer } });
      }
    });
  });

  describe("organization onboarding state RLS (DES-3 slice 2)", () => {
    it("enforces onboarding-state tenant boundaries", async () => {
      // DES-3 slice 2 table carries a direct org_id with forced RLS
      // (20261125120000_add_organization_onboarding_state): org-scoped
      // reads for every role; writes are owner/admin/estimator/dispatcher
      // spelled out explicitly (NOT via current_app_can_write(), which
      // the deployed 20260706120000 definition widened to include
      // technician). One row per org (UNIQUE org_id). The RLS assertions
      // below go through the request-scoped session (inSession /
      // currentTransaction), never through mocked Prisma; the admin client
      // only seeds fixtures and cleans up.
      const stateA = randomUUID();
      const stateB = randomUUID();
      await adminClient.organizationOnboardingState.createMany({
        data: [
          { id: stateA, orgId: orgA, status: "in_progress", currentStep: 2, workTypes: ["Painting"], laborRateCents: 4800 },
          { id: stateB, orgId: orgB, status: "skipped" },
        ],
      });
      try {
        // Same-org reads are allowed, for every role: the select policy
        // is org-scoped, not assignment-scoped.
        const visible = await inSession(adminUser, orgA, "admin", async () =>
          currentTransaction().organizationOnboardingState.findUnique({ where: { id: stateA } }),
        );
        expect(visible?.id).toBe(stateA);
        const technicianVisible = await inSession(technicianUser, orgA, "technician", async () =>
          currentTransaction().organizationOnboardingState.findUnique({ where: { id: stateA } }),
        );
        expect(technicianVisible?.id).toBe(stateA);

        // Cross-org reads are hidden.
        const hidden = await inSession(otherUser, orgB, "owner", async () =>
          currentTransaction().organizationOnboardingState.findUnique({ where: { id: stateA } }),
        );
        expect(hidden).toBeNull();
        const foreignOnly = await inSession(otherUser, orgB, "owner", async () =>
          currentTransaction().organizationOnboardingState.findMany(),
        );
        expect(foreignOnly.map((row) => row.id)).toEqual([stateB]);

        // Cross-org writes are denied even with a matching org_id claim.
        await expect(
          inSession(otherUser, orgB, "owner", async () =>
            currentTransaction().organizationOnboardingState.update({
              where: { id: stateA },
              data: { status: "skipped" },
            }),
          ),
        ).rejects.toThrow();

        // Viewers may read their own org's row but cannot write it.
        await expect(
          inSession(viewerUser, orgA, "viewer", async () =>
            currentTransaction().organizationOnboardingState.update({
              where: { id: stateA },
              data: { status: "skipped" },
            }),
          ),
        ).rejects.toThrow();

        // Technicians cannot write onboarding state at all.
        await expect(
          inSession(technicianUser, orgA, "technician", async () =>
            currentTransaction().organizationOnboardingState.update({
              where: { id: stateA },
              data: { status: "skipped" },
            }),
          ),
        ).rejects.toThrow();

        // A dispatcher write is allowed: the onboarding manager role
        // holds crm.write, and the policies name dispatcher explicitly.
        const dispatcherUser = randomUUID();
        const dispatcherMembership = randomUUID();
        await adminClient.appUser.create({
          data: { id: dispatcherUser, authSubject: "rls-des3-dispatcher", email: "rls-des3-dispatcher@example.com" },
        });
        await adminClient.organizationMembership.create({
          data: { id: dispatcherMembership, orgId: orgA, userId: dispatcherUser, role: "dispatcher", status: "active" },
        });
        try {
          const updated = await inSession(dispatcherUser, orgA, "dispatcher", async () =>
            currentTransaction().organizationOnboardingState.update({
              where: { id: stateA },
              data: { region: "Terre Haute, IN" },
            }),
          );
          expect(updated.region).toBe("Terre Haute, IN");
        } finally {
          await adminClient.organizationMembership.deleteMany({ where: { id: dispatcherMembership } });
          await adminClient.appUser.deleteMany({ where: { id: dispatcherUser } });
        }

        // The denied writes left the status untouched (the dispatcher
        // write above changed only the region, which is allowed).
        const after = await adminClient.organizationOnboardingState.findUniqueOrThrow({ where: { id: stateA } });
        expect(after.status).toBe("in_progress");
      } finally {
        await adminClient.organizationOnboardingState.deleteMany({ where: { id: { in: [stateA, stateB] } } });
      }
    });
  });
  describe("estimate scope clarification (DES-10-F1)", () => {
    const service = new AIEstimateAssistService();
    const deckProject = randomUUID();
    const deckEstimate = randomUUID();
    const questionKey = "existing-deck-footing-site-check.v1";
    const detail = "24 in × 12 in, sound concrete";
    const payload = {
      estimateId: deckEstimate,
      orgId: orgA,
      questionKey,
      expectedRevision: 0,
      answer: { kind: "details", detail: `  ${detail}  ` } as const,
    };
    const ownerSession = <T>(operation: () => Promise<T>) => inSession(adminUser, orgA, "admin", operation);

    beforeEach(async () => {
      await adminClient.project.create({
        data: { id: deckProject, orgId: orgA, customerId: customerA, name: "Deck", simpleScope: "Replace deck and reuse existing footings" },
      });
      await adminClient.estimate.create({
        data: {
          id: deckEstimate, orgId: orgA, projectId: deckProject, subtotalCost: 200, totalPrice: 237,
          lineItems: {
            create: { description: "Saved deck line", quantity: 1, unitOfMeasure: "EA", unitCost: 200, lineCost: 200 },
          },
        },
      });
    });

    afterEach(() => adminClient.project.delete({ where: { id: deckProject } }));

    it("saves, reloads and retries one normalized answer without changing saved items or money", async () => {
      const before = await adminClient.estimate.findUnique({ where: { id: deckEstimate }, include: { lineItems: true } });
      await expect(ownerSession(() => service.getScopeClarification(deckEstimate, orgA))).resolves.toMatchObject({
        questionKey, revision: 0, answer: null,
      });
      const responses = await Promise.all([
        ownerSession(() => service.saveScopeClarification(payload)),
        ownerSession(() => service.saveScopeClarification(payload)),
      ]);
      expect(responses[0]).toEqual(responses[1]);
      expect(responses[0]).toMatchObject({ questionKey, revision: 1, answer: { kind: "details", detail } });
      await expect(ownerSession(() => service.getScopeClarification(deckEstimate, orgA))).resolves.toEqual(responses[0]);
      expect(await adminClient.estimate.findUnique({ where: { id: deckEstimate }, include: { lineItems: true } })).toEqual(before);
    });

    it("denies cross-tenant clarification reads and writes at the service and database", async () => {
      await ownerSession(() => service.saveScopeClarification(payload));
      const foreign = <T>(operation: () => Promise<T>) => inSession(otherUser, orgB, "admin", operation);
      await expect(foreign(() => service.getScopeClarification(deckEstimate, orgB))).rejects.toMatchObject({ statusCode: 404 });
      await expect(foreign(() => service.saveScopeClarification({ ...payload, orgId: orgB }))).rejects.toMatchObject({ statusCode: 404 });
      await expect(foreign(() => currentTransaction().estimateScopeClarification.findMany({ where: { estimateId: deckEstimate } }))).resolves.toEqual([]);
      await expect(foreign(() => currentTransaction().estimateScopeClarification.create({
        data: { estimateId: deckEstimate, questionKey: "foreign-key", question: "Foreign", revision: 1, answerKind: "site_check_assumption" },
      }))).rejects.toThrow(/row.level security/i);
    });

    it("rejects a competing revision, saves the explicit assumption after refresh and denies technician writes", async () => {
      await ownerSession(() => service.saveScopeClarification(payload));
      const assumption = { ...payload, answer: { kind: "site_check_assumption" } as const };
      await expect(ownerSession(() => service.saveScopeClarification(assumption))).rejects.toMatchObject({ statusCode: 409 });
      const saved = await ownerSession(() => service.saveScopeClarification({ ...assumption, expectedRevision: 1 }));
      expect(saved).toMatchObject({ revision: 2, answer: { kind: "site_check_assumption" } });
      await expect(ownerSession(() => service.getScopeClarification(deckEstimate, orgA))).resolves.toEqual(saved);
      await expect(inSession(technicianUser, orgA, "technician", () => currentTransaction().estimateScopeClarification.create({
        data: { estimateId: deckEstimate, questionKey: "technician-key", question: "Not allowed", revision: 1, answerKind: "site_check_assumption" },
      }))).rejects.toThrow(/row.level security/i);
    });

    it("rejects a clarification save on a finalized estimate with the ESTIMATE_FINALIZED code", async () => {
      await adminClient.estimate.update({ where: { id: deckEstimate }, data: { status: "finalized" } });
      await expect(ownerSession(() => service.saveScopeClarification(payload))).rejects.toMatchObject({
        statusCode: 409,
        details: { code: "ESTIMATE_FINALIZED" },
      });
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

function inResendWebhookSession<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return appClient.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`select set_config('app.resend_webhook', 'true', true)`);
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
