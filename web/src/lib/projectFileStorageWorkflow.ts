import { isGeneratedProjectFileStoragePath } from "./projectFileStorage.ts";

export interface ProjectFileStorageRecord {
  id: string;
  storagePath?: string | null;
}

export interface StorageMutationResult {
  removed: boolean;
  reason: "removed" | "persisted" | "ambiguous" | "unexpected-path" | "no-storage-path" | "cleanup-failed";
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
