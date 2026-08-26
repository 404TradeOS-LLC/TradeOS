import type { ProjectFile } from "@/lib/api";
import { ProjectPhotoPanel } from "@/components/projects/project-photo-panel";

interface ProjectPhotoGalleryProps {
  projectFiles: ProjectFile[];
  projectId?: string;
  editable?: boolean;
}

export function ProjectPhotoGallery({ projectFiles, projectId, editable = false }: ProjectPhotoGalleryProps) {
  return <ProjectPhotoPanel projectFiles={projectFiles} projectId={projectId} editable={editable} title="Project photos" emptyMessage="No project photos saved yet." />;
}

