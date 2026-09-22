import "server-only";

import type { ProjectFile } from "@/lib/api";
import { buildProjectFileAccessUrl } from "@/lib/project-file-access";
import { isPublicStorageBucketValue } from "@/lib/storage-visibility";

export interface ProjectFileAsset extends ProjectFile {
  accessUrl: string;
  accessMode: "public" | "private-proxy" | "legacy";
}

export function isPublicStorageBucket() {
  return isPublicStorageBucketValue(process.env.SUPABASE_STORAGE_BUCKET_PUBLIC);
}

export function buildStorageObjectUrl(bucket: string, path: string, isPublicBucket: boolean) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  const objectAccessSegment = isPublicBucket ? "public" : "authenticated";
  return `${supabaseUrl}/storage/v1/object/${objectAccessSegment}/${bucket}/${path}`;
}

export function resolveProjectFileAssets(projectId: string, projectFiles: ProjectFile[]): ProjectFileAsset[] {
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "project-files";
  const isPublicBucket = isPublicStorageBucket();

  return projectFiles.map((file) => {
    if (!file.storagePath) {
      return {
        ...file,
        accessUrl: file.fileUrl,
        accessMode: "legacy" as const,
      };
    }

    if (isPublicBucket) {
      return {
        ...file,
        accessUrl: buildStorageObjectUrl(bucket, file.storagePath, true),
        accessMode: "public" as const,
      };
    }

    return {
      ...file,
      accessUrl: buildProjectFileAccessUrl(projectId, file),
      accessMode: "private-proxy" as const,
    };
  });
}
