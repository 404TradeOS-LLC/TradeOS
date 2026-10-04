export interface SiteVisitJobCandidate {
  id: string;
  archivedAt: string | null;
}

export function firstSiteVisitSearchParam(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim() || null;
}

export function resolveSiteVisitJob<T extends SiteVisitJobCandidate>(
  jobs: ReadonlyArray<T>,
  value: string | string[] | undefined
): T | null {
  const jobId = firstSiteVisitSearchParam(value);
  if (!jobId) return null;
  return jobs.find((job) => job.id === jobId && !job.archivedAt) ?? null;
}

export function canCaptureSiteVisit(role: string): boolean {
  return role === "owner" || role === "admin" || role === "dispatcher";
}

export function buildSiteVisitCaptureHref(projectId: string, jobId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/intake?job=${encodeURIComponent(jobId)}`;
}
