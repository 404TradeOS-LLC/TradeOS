import type { AuthContext } from "../../backend/auth/context";
import { CostbookRepository } from "./repository";
import { getCostbookPermissionSummary } from "./permissions";
import type { CostbookWorkspaceArea, CostbookWorkspaceDTO } from "./types";

const workspaceAreas: CostbookWorkspaceArea[] = [
  {
    id: "materials",
    label: "Materials",
    description: "Existing tenant-scoped material catalog inventory.",
    status: "existing_catalog",
  },
  {
    id: "labor",
    label: "Labor",
    description: "Existing tenant-scoped labor-rate inventory.",
    status: "existing_catalog",
  },
  {
    id: "equipment",
    label: "Equipment",
    description: "Existing tenant-scoped equipment-rate inventory.",
    status: "existing_catalog",
  },
  {
    id: "assemblies",
    label: "Assemblies",
    description: "Existing tenant-scoped assembly inventory.",
    status: "existing_catalog",
  },
  {
    id: "pricing-rules",
    label: "Pricing Rules",
    description: "Reserved for future Costbook pricing governance.",
    status: "future",
  },
  {
    id: "price-history",
    label: "Price History",
    description: "Reserved for future Costbook price-history workflows.",
    status: "future",
  },
];

export class CostbookService {
  constructor(private readonly repository = new CostbookRepository()) {}

  async getWorkspace(auth: AuthContext): Promise<CostbookWorkspaceDTO> {
    const [workspace, counts] = await Promise.all([
      this.repository.getWorkspace(auth.orgId),
      this.repository.getInventoryCounts(auth.orgId),
    ]);

    return {
      organizationId: auth.orgId,
      initialized: Boolean(workspace),
      status: workspace?.status ?? "foundation",
      permissions: getCostbookPermissionSummary(auth.role),
      counts,
      areas: workspaceAreas,
    };
  }
}
