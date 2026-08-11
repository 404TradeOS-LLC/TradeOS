import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { getCompanyLogoStorageAdapter } from "../company/storage";
import {
  CompanyProfileInput,
  CreateCustomerInput,
  CustomerEquipmentInput,
  CustomerImportResult,
  NoteInput,
  PaymentInput,
  ServiceAddressInput,
  ServiceAgreementInput,
  UpdateCustomerInput,
} from "./types";

export interface CustomerListOptions {
  query?: string;
  limit?: number;
}

const CUSTOMER_LIST_DEFAULT_LIMIT = 100;
const CUSTOMER_LIST_MAX_LIMIT = 250;

export class CrmService {
  async listCustomers(orgId: string, options: CustomerListOptions = {}) {
    const query = options.query?.trim();
    const requestedLimit = options.limit ?? CUSTOMER_LIST_DEFAULT_LIMIT;
    const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), CUSTOMER_LIST_MAX_LIMIT);

    return prisma.customer.findMany({
      where: {
        orgId,
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: limit,
    });
  }

  async createCustomer(orgId: string, input: CreateCustomerInput) {
    return prisma.customer.create({
      data: {
        orgId,
        name: input.name,
        email: emptyToNull(input.email),
        phone: emptyToNull(input.phone),
        address: emptyToNull(input.address),
        billingAddress: emptyToNull(input.billingAddress),
        notes: emptyToNull(input.notes),
      },
    });
  }

  async getCustomer(orgId: string, customerId: string) {
    const row = await prisma.customer.findFirst({
      where: { id: customerId, orgId, deletedAt: null },
      include: {
        projects: { orderBy: { createdAt: "desc" } },
        serviceAddresses: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        equipmentAssets: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!row) throw new ApiError(404, `Customer ${customerId} not found`);

    const notes = await prisma.comment.findMany({
      where: { orgId, entityType: "customer", entityId: customerId },
      orderBy: { createdAt: "desc" },
    });

    return { ...row, notes };
  }

  async updateCustomer(orgId: string, customerId: string, input: UpdateCustomerInput) {
    await this.assertCustomer(orgId, customerId);
    return prisma.customer.update({
      where: { id: customerId },
      data: {
        name: input.name,
        email: input.email !== undefined ? emptyToNull(input.email) : undefined,
        phone: input.phone !== undefined ? emptyToNull(input.phone) : undefined,
        address: input.address !== undefined ? emptyToNull(input.address) : undefined,
        billingAddress: input.billingAddress !== undefined ? emptyToNull(input.billingAddress) : undefined,
        notes: input.notes !== undefined ? emptyToNull(input.notes) : undefined,
      },
    });
  }

  async removeCustomer(orgId: string, customerId: string) {
    await this.assertCustomer(orgId, customerId);
    await prisma.customer.update({
      where: { id: customerId },
      data: { deletedAt: new Date() },
    });
  }

  async addServiceAddress(orgId: string, customerId: string, input: ServiceAddressInput) {
    await this.assertCustomer(orgId, customerId);

    return prisma.$transaction(async (transaction) => {
      if (input.isPrimary) {
        await transaction.serviceAddress.updateMany({
          where: { orgId, customerId, deletedAt: null },
          data: { isPrimary: false },
        });
      }

      return transaction.serviceAddress.create({
        data: {
          orgId,
          customerId,
          label: emptyToNull(input.label),
          addressLine1: input.addressLine1,
          addressLine2: emptyToNull(input.addressLine2),
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: emptyToNull(input.country) ?? "US",
          isPrimary: input.isPrimary ?? false,
        },
      });
    });
  }

  async updateServiceAddress(orgId: string, customerId: string, addressId: string, input: Partial<ServiceAddressInput>) {
    const existing = await prisma.serviceAddress.findFirst({
      where: { id: addressId, orgId, customerId, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, `Service address ${addressId} not found`);

    return prisma.$transaction(async (transaction) => {
      if (input.isPrimary) {
        await transaction.serviceAddress.updateMany({
          where: { orgId, customerId, deletedAt: null },
          data: { isPrimary: false },
        });
      }

      return transaction.serviceAddress.update({
        where: { id: addressId },
        data: {
          label: input.label !== undefined ? emptyToNull(input.label) : undefined,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 !== undefined ? emptyToNull(input.addressLine2) : undefined,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country !== undefined ? emptyToNull(input.country) : undefined,
          isPrimary: input.isPrimary,
        },
      });
    });
  }

  async removeServiceAddress(orgId: string, customerId: string, addressId: string) {
    const existing = await prisma.serviceAddress.findFirst({
      where: { id: addressId, orgId, customerId, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, `Service address ${addressId} not found`);

    await prisma.serviceAddress.update({
      where: { id: addressId },
      data: { deletedAt: new Date(), isPrimary: false },
    });
  }

  async addEquipment(orgId: string, customerId: string, input: CustomerEquipmentInput) {
    await this.assertCustomer(orgId, customerId);
    if (input.serviceAddressId) {
      await this.assertServiceAddress(orgId, customerId, input.serviceAddressId);
    }

    return prisma.customerEquipment.create({
      data: {
        orgId,
        customerId,
        serviceAddressId: input.serviceAddressId,
        name: input.name,
        manufacturer: emptyToNull(input.manufacturer),
        model: emptyToNull(input.model),
        serialNumber: emptyToNull(input.serialNumber),
        installedAt: input.installedAt ? new Date(input.installedAt) : undefined,
        status: input.status ?? "active",
        notes: emptyToNull(input.notes),
      },
    });
  }

  async updateEquipment(orgId: string, customerId: string, equipmentId: string, input: Partial<CustomerEquipmentInput>) {
    const existing = await prisma.customerEquipment.findFirst({
      where: { id: equipmentId, orgId, customerId, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, `Equipment ${equipmentId} not found`);
    if (input.serviceAddressId) {
      await this.assertServiceAddress(orgId, customerId, input.serviceAddressId);
    }

    return prisma.customerEquipment.update({
      where: { id: equipmentId },
      data: {
        serviceAddressId: input.serviceAddressId,
        name: input.name,
        manufacturer: input.manufacturer !== undefined ? emptyToNull(input.manufacturer) : undefined,
        model: input.model !== undefined ? emptyToNull(input.model) : undefined,
        serialNumber: input.serialNumber !== undefined ? emptyToNull(input.serialNumber) : undefined,
        installedAt: input.installedAt !== undefined ? (input.installedAt ? new Date(input.installedAt) : null) : undefined,
        status: input.status,
        notes: input.notes !== undefined ? emptyToNull(input.notes) : undefined,
      },
    });
  }

  async removeEquipment(orgId: string, customerId: string, equipmentId: string) {
    const existing = await prisma.customerEquipment.findFirst({
      where: { id: equipmentId, orgId, customerId, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, `Equipment ${equipmentId} not found`);
    await prisma.customerEquipment.update({
      where: { id: equipmentId },
      data: { deletedAt: new Date() },
    });
  }

  async listNotes(orgId: string, entityType: "customer" | "job", entityId: string) {
    await this.assertNoteEntity(orgId, entityType, entityId);
    return prisma.comment.findMany({
      where: { orgId, entityType, entityId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createNote(orgId: string, authorUserId: string, input: NoteInput) {
    await this.assertNoteEntity(orgId, input.entityType, input.entityId);
    return prisma.comment.create({
      data: {
        orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        body: input.body,
        authorUserId,
      },
    });
  }

  async importCustomers(orgId: string, csvContent: string): Promise<CustomerImportResult> {
    const parsed = parseCsv(csvContent);
    if (parsed.rows.length === 0) {
      return { successCount: 0, duplicateCount: 0, malformedRows: [{ rowNumber: 1, message: "CSV contained no data rows" }] };
    }

    const requiredHeaders = ["name", "phone", "email", "address"];
    const missingHeaders = requiredHeaders.filter((header) => !parsed.headers.includes(header));
    if (missingHeaders.length > 0) {
      return {
        successCount: 0,
        duplicateCount: 0,
        malformedRows: [{ rowNumber: 1, message: `Missing required headers: ${missingHeaders.join(", ")}` }],
      };
    }

    const existingCustomers = await prisma.customer.findMany({
      where: { orgId, deletedAt: null },
      select: { email: true, phone: true },
    });
    const knownEmails = new Set(existingCustomers.map((row) => normalize(row.email)).filter(Boolean));
    const knownPhones = new Set(existingCustomers.map((row) => normalizePhone(row.phone)).filter(Boolean));
    const batchEmails = new Set<string>();
    const batchPhones = new Set<string>();

    let successCount = 0;
    let duplicateCount = 0;
    const malformedRows: Array<{ rowNumber: number; message: string }> = [];

    for (const row of parsed.rows) {
      if (row.malformedMessage) {
        malformedRows.push({ rowNumber: row.rowNumber, message: row.malformedMessage });
        continue;
      }

      const name = row.values.name?.trim();
      const email = row.values.email?.trim();
      const phone = row.values.phone?.trim();
      const address = row.values.address?.trim();

      if (!name) {
        malformedRows.push({ rowNumber: row.rowNumber, message: "Missing required name" });
        continue;
      }

      const emailKey = normalize(email);
      const phoneKey = normalizePhone(phone);
      const duplicate = Boolean(
        (emailKey && (knownEmails.has(emailKey) || batchEmails.has(emailKey))) ||
          (phoneKey && (knownPhones.has(phoneKey) || batchPhones.has(phoneKey)))
      );
      if (duplicate) {
        duplicateCount += 1;
        continue;
      }

      await prisma.customer.create({
        data: {
          orgId,
          name,
          email: emptyToNull(email),
          phone: emptyToNull(phone),
          address: emptyToNull(address),
        },
      });
      if (emailKey) batchEmails.add(emailKey);
      if (phoneKey) batchPhones.add(phoneKey);
      successCount += 1;
    }

    return { successCount, duplicateCount, malformedRows };
  }

  async getCompanyProfile(orgId: string) {
    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!organization) throw new ApiError(404, `Organization ${orgId} not found`);
    const settings = await prisma.organizationSettings.findUnique({ where: { orgId } });
    const json = isRecord(settings?.settingsJson) ? settings?.settingsJson : {};

    return {
      companyName: typeof json.companyName === "string" ? json.companyName : organization.name,
      phone: typeof json.phone === "string" ? json.phone : organization.phone,
      email: typeof json.email === "string" ? json.email : organization.email,
      address: typeof json.address === "string" ? json.address : organization.address,
      logoUrl: typeof json.logoUrl === "string" ? json.logoUrl : organization.logoUrl,
      primaryColor: typeof json.primaryColor === "string" ? json.primaryColor : null,
      secondaryColor: typeof json.secondaryColor === "string" ? json.secondaryColor : null,
      storage: getCompanyLogoStorageAdapter()
        ? { logoUpload: "supported" }
        : {
            logoUpload: "not_configured",
            message: "No storage adapter is configured. Implement CompanyLogoStorageAdapter before enabling binary uploads.",
          },
    };
  }

  async upsertCompanyProfile(orgId: string, input: CompanyProfileInput) {
    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!organization) throw new ApiError(404, `Organization ${orgId} not found`);

    const previous = await prisma.organizationSettings.findUnique({ where: { orgId } });
    const previousJson = isRecord(previous?.settingsJson) ? previous.settingsJson : {};
    const settingsJson: Prisma.InputJsonValue = {
      ...previousJson,
      companyName: input.companyName,
      phone: input.phone ?? "",
      email: input.email ?? "",
      address: input.address ?? "",
      logoUrl: input.logoUrl ?? "",
      primaryColor: input.primaryColor ?? "",
      secondaryColor: input.secondaryColor ?? "",
    };

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        name: input.companyName,
        phone: emptyToNull(input.phone),
        email: emptyToNull(input.email),
        address: emptyToNull(input.address),
        logoUrl: emptyToNull(input.logoUrl),
      },
    });

    await prisma.organizationSettings.upsert({
      where: { orgId },
      update: { settingsJson },
      create: { orgId, settingsJson },
    });

    return this.getCompanyProfile(orgId);
  }

  async listServiceAgreements(orgId: string, customerId: string) {
    await this.assertCustomer(orgId, customerId);
    return prisma.serviceAgreement.findMany({
      where: { orgId, customerId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createServiceAgreement(orgId: string, customerId: string, input: ServiceAgreementInput) {
    await this.assertCustomer(orgId, customerId);
    if (input.serviceAddressId) await this.assertServiceAddress(orgId, customerId, input.serviceAddressId);
    if (input.projectId) {
      const project = await prisma.project.findFirst({ where: { id: input.projectId, orgId, customerId } });
      if (!project) throw new ApiError(404, `Job ${input.projectId} not found`);
    }

    return prisma.serviceAgreement.create({
      data: {
        orgId,
        customerId,
        serviceAddressId: input.serviceAddressId,
        projectId: input.projectId,
        name: input.name,
        status: input.status ?? "draft",
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        billingCadence: emptyToNull(input.billingCadence),
        amount: input.amount ?? undefined,
        terms: emptyToNull(input.terms),
      },
    });
  }

  async listPayments(orgId: string, invoiceId: string) {
    await this.assertInvoice(orgId, invoiceId);
    return prisma.payment.findMany({
      where: { orgId, invoiceId },
      orderBy: { paymentDate: "desc" },
    });
  }

  async createPayment(orgId: string, invoiceId: string, input: PaymentInput) {
    await this.assertInvoice(orgId, invoiceId);
    return prisma.payment.create({
      data: {
        orgId,
        invoiceId,
        amount: input.amount,
        paymentDate: new Date(input.paymentDate),
        method: input.method,
        status: input.status ?? "recorded",
        reference: emptyToNull(input.reference),
        notes: emptyToNull(input.notes),
      },
    });
  }

  private async assertCustomer(orgId: string, customerId: string) {
    const row = await prisma.customer.findFirst({ where: { id: customerId, orgId, deletedAt: null } });
    if (!row) throw new ApiError(404, `Customer ${customerId} not found`);
    return row;
  }

  private async assertServiceAddress(orgId: string, customerId: string, addressId: string) {
    const row = await prisma.serviceAddress.findFirst({
      where: { id: addressId, orgId, customerId, deletedAt: null },
    });
    if (!row) throw new ApiError(404, `Service address ${addressId} not found`);
    return row;
  }

  private async assertNoteEntity(orgId: string, entityType: "customer" | "job", entityId: string) {
    if (entityType === "customer") {
      await this.assertCustomer(orgId, entityId);
      return;
    }

    const row = await prisma.job.findFirst({ where: { id: entityId, orgId } });
    if (!row) throw new ApiError(404, `Job ${entityId} not found`);
  }

  private async assertInvoice(orgId: string, invoiceId: string) {
    const row = await prisma.invoice.findFirst({ where: { id: invoiceId, project: { orgId } } });
    if (!row) throw new ApiError(404, `Invoice ${invoiceId} not found`);
  }
}

function emptyToNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalize(value?: string | null): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

function normalizePhone(value?: string | null): string | null {
  const digits = value?.replace(/\D/g, "");
  return digits ? digits : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCsv(csvContent: string): {
  headers: string[];
  rows: Array<{ rowNumber: number; values: Record<string, string>; malformedMessage?: string }>;
} {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
  const rows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const rowNumber = index + 2;
    if (values.length !== headers.length) {
      return {
        rowNumber,
        values: {},
        malformedMessage: `Expected ${headers.length} columns but received ${values.length}`,
      };
    }

    return {
      rowNumber,
      values: Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""])),
    };
  });

  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}