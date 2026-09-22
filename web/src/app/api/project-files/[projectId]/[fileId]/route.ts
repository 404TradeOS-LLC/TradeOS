import { ApiClientError, getProject } from "@/lib/api";
import { isGeneratedProjectFileStoragePath } from "@/lib/projectFileStorage";
import { getSessionToken } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_PROJECT_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_PROJECT_DOCUMENT_BYTES = 12 * 1024 * 1024;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  const { projectId, fileId } = await params;
  const token = await getSessionToken();
  if (!token) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let project;
  try {
    project = await getProject(token, projectId);
  } catch (error) {
    if (error instanceof ApiClientError && [401, 403, 404].includes(error.status)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }

  const file = project.projectFiles.find((candidate) => candidate.id === fileId);
  if (!file?.storagePath || !isGeneratedProjectFileStoragePath(projectId, file.storagePath)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "project-files";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).download(file.storagePath);
  if (error || !data) {
    console.error("project-files proxy: failed to download authorized object", file.storagePath, error);
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const maxResponseBytes = file.fileType === "photo" ? MAX_PROJECT_PHOTO_BYTES : MAX_PROJECT_DOCUMENT_BYTES;
  if (data.size > maxResponseBytes) {
    console.error("project-files proxy: authorized object exceeds project-file size limit", file.storagePath, data.size);
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(data.stream(), {
    status: 200,
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName).replaceAll("'", "%27")}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
