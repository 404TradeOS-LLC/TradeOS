type DashboardSettingsContext = {
  companyName?: string | null;
  timezone?: string | null;
} | null | undefined;

type DashboardStartupDependencies<TProject, TSettingsResponse> = {
  listProjects: (token: string) => Promise<TProject[]>;
  getOrganizationSettings: (token: string) => Promise<TSettingsResponse>;
};

/**
 * Loads dashboard startup data without allowing a settings outage to discard
 * successfully loaded project data.
 */
export async function loadDashboardStartup<TProject, TSettingsResponse>(
  token: string,
  dependencies: DashboardStartupDependencies<TProject, TSettingsResponse>,
): Promise<{ projects: TProject[]; settingsResponse: TSettingsResponse | null }> {
  const [projects, settingsResponse] = await Promise.all([
    dependencies.listProjects(token),
    dependencies.getOrganizationSettings(token).catch(() => null),
  ]);

  return { projects, settingsResponse };
}

function getSafeTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Resolves truthful organization context for dashboard labels and local-day
 * calculations. When settings are unavailable, the organization identity is
 * explicitly unavailable and the dispatch summary remains the timezone source.
 */
export function resolveDashboardOrganizationContext(settings: DashboardSettingsContext, dispatchTimeZone: string) {
  const companyName = settings?.companyName?.trim() || "Organization unavailable";
  const timeZone = getSafeTimeZone(settings?.timezone?.trim() || dispatchTimeZone);

  return { companyName, timeZone };
}
