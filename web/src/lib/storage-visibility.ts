export function isPublicStorageBucketValue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
