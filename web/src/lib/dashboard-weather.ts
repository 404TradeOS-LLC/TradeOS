export interface DashboardWeatherAddressInput {
  jobSiteAddresses: ReadonlyArray<string | null | undefined>;
  persistedOrganizationAddress?: string | null;
}

/**
 * Standing dashboard weather is intentionally disabled. Product direction requires
 * weather to appear only when a scheduled exterior job has an adverse forecast and
 * therefore belongs in the needs-attention queue. Keep this compatibility seam until
 * dashboard/page.tsx drops the old import; it returns null so no Census/NWS request is
 * performed from the generic dashboard header.
 */
export function selectDashboardWeatherAddress(input: DashboardWeatherAddressInput): string | null {
  void input;
  return null;
}

export async function loadDashboardWeather<T>(
  address: string | null,
  lookup: (address: string) => Promise<T>
): Promise<T | null> {
  if (!address) return null;

  try {
    return await lookup(address);
  } catch {
    return null;
  }
}
