export const EQUIPMENT_LOAD_TIMEOUT_MS = 15_000;

type EquipmentLoaders<TWorkspace, TEquipment> = {
  getWorkspace: (token: string, signal: AbortSignal) => Promise<TWorkspace>;
  listEquipment: (token: string, signal: AbortSignal) => Promise<TEquipment[]>;
};

/** Creates the bounded AbortSignal shared by both equipment-page backend reads. */
export function createEquipmentLoadSignal(): AbortSignal {
  return AbortSignal.timeout(EQUIPMENT_LOAD_TIMEOUT_MS);
}

/** Loads workspace and equipment data with one shared bounded cancellation signal. */
export async function loadEquipmentPageData<TWorkspace, TEquipment>(
  token: string,
  loaders: EquipmentLoaders<TWorkspace, TEquipment>,
): Promise<[TWorkspace, TEquipment[]]> {
  const signal = createEquipmentLoadSignal();
  return Promise.all([
    loaders.getWorkspace(token, signal),
    loaders.listEquipment(token, signal),
  ]);
}
