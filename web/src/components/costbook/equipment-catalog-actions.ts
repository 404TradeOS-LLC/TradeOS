export type EquipmentCatalogPayload = {
  name: string;
  ownershipCostPerHour: number;
  operatingCostPerHour: number;
  dailyRate: number | null;
};

export type EquipmentCatalogRecord = EquipmentCatalogPayload & {
  id: string;
  organizationId: string;
  hourlyCost: number;
  createdAt: string;
  updatedAt: string;
};

export type EquipmentCatalogFetcher = <T>(path: string, init?: RequestInit) => Promise<T>;

export type EquipmentCatalogCapabilities = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  showActions: boolean;
};

export function getEquipmentCatalogCapabilities(
  canWrite: boolean,
  canManage: boolean
): EquipmentCatalogCapabilities {
  return {
    canCreate: canWrite,
    canEdit: canWrite,
    canDelete: canManage,
    showActions: canWrite || canManage,
  };
}

export function createEquipmentCatalogRecord(
  fetcher: EquipmentCatalogFetcher,
  payload: EquipmentCatalogPayload
): Promise<EquipmentCatalogRecord> {
  return fetcher<EquipmentCatalogRecord>("/costbook/equipment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEquipmentCatalogRecord(
  fetcher: EquipmentCatalogFetcher,
  id: string,
  payload: EquipmentCatalogPayload
): Promise<EquipmentCatalogRecord> {
  return fetcher<EquipmentCatalogRecord>(`/costbook/equipment/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteEquipmentCatalogRecord(
  fetcher: EquipmentCatalogFetcher,
  id: string
): Promise<void> {
  return fetcher<void>(`/costbook/equipment/${id}`, { method: "DELETE" });
}
