const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERATED_PROJECT_FILE_OBJECT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-zA-Z0-9._-]+$/;

export function isSafeProjectId(projectId: string): boolean {
  return UUID_PATTERN.test(projectId);
}

export function buildProjectFilePath(projectId: string, fileName: string): string {
  if (!isSafeProjectId(projectId)) {
    throw new Error("Invalid project id.");
  }

  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-") || "file";
  return `${projectId}/${crypto.randomUUID()}-${sanitizedName}`;
}

export function isGeneratedProjectFileStoragePath(projectId: string, storagePath: string): boolean {
  if (!isSafeProjectId(projectId)) return false;
  const prefix = `${projectId}/`;
  if (!storagePath.startsWith(prefix)) return false;
  return GENERATED_PROJECT_FILE_OBJECT_PATTERN.test(storagePath.slice(prefix.length));
}
