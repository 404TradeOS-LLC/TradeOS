/** Bind a mutation to the job revision shown to the user, never a freshly fetched revision. */
export function withJobRevision<T extends Record<string, unknown>>(updatedAt: unknown, payload: T) {
  if (typeof updatedAt !== "string" || !updatedAt || !Number.isFinite(Date.parse(updatedAt))) {
    throw new Error("Job revision is unavailable. Refresh this workspace before saving.");
  }
  return { ...payload, expectedUpdatedAt: updatedAt };
}
