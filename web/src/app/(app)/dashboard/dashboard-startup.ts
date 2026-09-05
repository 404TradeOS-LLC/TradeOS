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

/**
 * Loads the bounded recent-project detail fan-out without allowing one failed
 * project request to discard healthy siblings and crash the whole dashboard.
 */
export async function loadDashboardProjectDetails<TProject extends { id: string }, TProjectDetail>(
  token: string,
  projects: TProject[],
  limit: number,
  getProject: (token: string, projectId: string) => Promise<TProjectDetail>,
): Promise<{ items: TProjectDetail[]; failedCount: number }> {
  const results = await Promise.allSettled(
    projects.slice(0, limit).map((project) => getProject(token, project.id)),
  );
  const items: TProjectDetail[] = [];
  let failedCount = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      items.push(result.value);
    } else {
      failedCount += 1;
    }
  }

  return { items, failedCount };
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
