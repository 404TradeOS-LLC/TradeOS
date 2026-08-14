export interface DashboardWeatherAddressInput {
  jobSiteAddresses: ReadonlyArray<string | null | undefined>;
  persistedOrganizationAddress?: string | null;
}

function normalizeAddress(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function selectDashboardWeatherAddress({
  jobSiteAddresses,
  persistedOrganizationAddress,
}: DashboardWeatherAddressInput): string | null {
  for (const address of jobSiteAddresses) {
    const normalized = normalizeAddress(address);
    if (normalized) return normalized;
  }

  return normalizeAddress(persistedOrganizationAddress);
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
