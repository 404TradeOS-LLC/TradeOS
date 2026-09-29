interface ProjectFileAccessRecord {
  id: string;
  fileUrl: string;
  storagePath: string | null;
}

export function buildProjectFileAccessUrl(projectId: string, file: ProjectFileAccessRecord): string {
  if (!file.storagePath) return file.fileUrl;

  return `/api/project-files/${encodeURIComponent(projectId)}/${encodeURIComponent(file.id)}`;
}
