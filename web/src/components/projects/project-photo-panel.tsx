import { deleteProjectFileAction } from "@/app/actions/projects";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectFile } from "@/lib/api";
import { resolveProjectFileAssets } from "@/lib/storage";

interface ProjectPhotoPanelProps {
  projectFiles: ProjectFile[];
  projectId?: string;
  editable?: boolean;
  title?: string;
  emptyMessage?: string;
}

export async function ProjectPhotoPanel({
  projectFiles,
  projectId,
  editable = false,
  title = "Project photos",
  emptyMessage = "No project photos saved yet.",
}: ProjectPhotoPanelProps) {
  const photoFiles = projectFiles.filter((file) => file.fileType === "photo");
  const photoAssets = await resolveProjectFileAssets(photoFiles);

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {photoAssets.length === 0 ? (
          <EmptyState title={title} description={emptyMessage} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {photoAssets.map((file) => (
              <li key={file.id} className="overflow-hidden rounded-xl border border-border/60 bg-background/80">
                <a href={file.accessUrl} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={file.accessUrl} alt={`${file.fileName} project photo`} className="h-40 w-full object-cover" />
                </a>
                <div className="space-y-2 p-3">
                  <div className="font-medium text-foreground">{file.fileName}</div>
                  <div className="text-sm text-muted-foreground">{describeFileSource(file.accessUrl, file.accessMode)}</div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={file.accessUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      Open photo
                    </a>
                    {editable && projectId && (
                      <form action={deleteProjectFileAction}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="fileId" value={file.id} />
                        <input type="hidden" name="storagePath" value={file.storagePath ?? ""} />
                        <button
                          type="submit"
                          className="inline-flex rounded-md border border-destructive/30 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                        >
                              Delete photo
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function describeFileSource(url: string, accessMode: "public" | "signed" | "legacy") {
  try {
    const hostname = new URL(url).hostname;
    if (accessMode === "signed") return `${hostname} • private signed access`;
    if (accessMode === "public") return `${hostname} • storage public URL`;
    return `${hostname} • saved file URL`;
  } catch {
    return accessMode === "signed" ? "Private signed access" : "Saved file URL";
  }
}
