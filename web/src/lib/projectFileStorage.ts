const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERATED_PROJECT_FILE_OBJECT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-zA-Z0-9._-]+$/;

export interface ProjectFileStorageRecord {
  id: string;
  storagePath?: string | null;
}

export interface StorageMutationResult {
  removed: boolean;
  reason: "removed" | "persisted" | "ambiguous" | "unexpected-path" | "no-storage-path" | "cleanup-failed";
}

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

async function tryRemoveStorage(
  storagePath: string,
  removeStorage: (storagePath: string) => Promise<void>
): Promise<StorageMutationResult> {
  try {
    await removeStorage(storagePath);
    return { removed: true, reason: "removed" };
  } catch {
    return { removed: false, reason: "cleanup-failed" };
  }
}

export async function cleanupUploadedProjectFileAfterMetadataFailure(options: {
  projectId: string;
  storagePath: string;
  listProjectFiles: () => Promise<ProjectFileStorageRecord[]>;
  removeStorage: (storagePath: string) => Promise<void>;
}): Promise<StorageMutationResult> {
  let projectFiles: ProjectFileStorageRecord[];
  try {
    projectFiles = await options.listProjectFiles();
  } catch {
    return { removed: false, reason: "ambiguous" };
  }

  if (projectFiles.some((projectFile) => projectFile.storagePath === options.storagePath)) {
    return { removed: false, reason: "persisted" };
  }

  return tryRemoveStorage(options.storagePath, options.removeStorage);
}

export async function deleteAuthorizedProjectFileStorage(options: {
  projectId: string;
  fileId: string;
  listProjectFiles: () => Promise<ProjectFileStorageRecord[]>;
  deleteMetadata: () => Promise<void>;
  removeStorage: (storagePath: string) => Promise<void>;
}): Promise<StorageMutationResult> {
  const projectFiles = await options.listProjectFiles();
  const projectFile = projectFiles.find((file) => file.id === options.fileId);
  if (!projectFile) {
    throw new Error("Project file not found.");
  }

  await options.deleteMetadata();

  if (!projectFile.storagePath) {
    return { removed: false, reason: "no-storage-path" };
  }
  if (!isGeneratedProjectFileStoragePath(options.projectId, projectFile.storagePath)) {
    return { removed: false, reason: "unexpected-path" };
  }

  return tryRemoveStorage(projectFile.storagePath, options.removeStorage);
}
