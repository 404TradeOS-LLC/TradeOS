import { isGeneratedProjectFileStoragePath } from "./projectFileStorage";

export interface ProjectFileStorageRecord {
  id: string;
  storagePath?: string | null;
}

export interface StorageMutationResult {
  removed: boolean;
  reason: "removed" | "persisted" | "ambiguous" | "unexpected-path" | "no-storage-path";
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

  await options.removeStorage(options.storagePath);
  return { removed: true, reason: "removed" };
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

  await options.removeStorage(projectFile.storagePath);
  return { removed: true, reason: "removed" };
}
