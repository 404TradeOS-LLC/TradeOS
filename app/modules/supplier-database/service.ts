import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { CreateSupplierInput, SupplierDTO, UpdateSupplierInput } from "./types";

// Supplier Database module: supplier contact records that materials and
// supplier-fed price proposals (modules/supplier-integration) reference.
export class SupplierDatabaseService {
  async list(orgId?: string): Promise<SupplierDTO[]> {
    const rows = await prisma.supplier.findMany({
      where: orgId ? { orgId } : undefined,
      orderBy: { name: "asc" },
    });
    return rows.map(toDTO);
  }

  async getById(id: string, orgId?: string): Promise<SupplierDTO> {
    const row = await prisma.supplier.findFirst({ where: { id, orgId } });
    if (!row) throw new ApiError(404, `Supplier ${id} not found`);
    return toDTO(row);
  }

  async create(input: CreateSupplierInput): Promise<SupplierDTO> {
    const row = await prisma.supplier.create({
      data: {
        orgId: input.orgId,
        name: input.name,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        website: input.website,
        apiIntegrationKey: input.apiIntegrationKey,
      },
    });
    return toDTO(row);
  }

  async update(id: string, input: UpdateSupplierInput, orgId?: string): Promise<SupplierDTO> {
    await this.assertExists(id, orgId);
    const row = await prisma.supplier.update({
      where: { id },
      data: {
        name: input.name,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        website: input.website,
        apiIntegrationKey: input.apiIntegrationKey,
      },
    });
    return toDTO(row);
  }

  // Materials referencing this supplier are detached (supplier_id set to
  // null) rather than deleted. Any supplier_price_updates history blocks
  // deletion outright (foreign key is ON DELETE RESTRICT) the same way
  // material_price_audits protects material deletion.
  async delete(id: string, orgId?: string): Promise<void> {
    await this.assertExists(id, orgId);
    await prisma.supplier.delete({ where: { id } });
  }

  private async assertExists(id: string, orgId?: string): Promise<void> {
    const exists = await prisma.supplier.findFirst({ where: { id, orgId } });
    if (!exists) throw new ApiError(404, `Supplier ${id} not found`);
  }
}

function toDTO(row: {
  id: string;
  orgId: string | null;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  apiIntegrationKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SupplierDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    website: row.website,
    hasApiIntegrationKey: row.apiIntegrationKey != null && row.apiIntegrationKey.length > 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
