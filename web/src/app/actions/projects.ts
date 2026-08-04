"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch, ApiClientError, Estimate } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { buildStorageObjectUrl, isPublicStorageBucket } from "@/lib/storage";
import { FormActionState } from "./customers";

const MAX_PROJECT_PHOTOS = 4;
const MAX_STANDARD_UPLOAD_BYTES = 6 * 1024 * 1024;
const MAX_DOCUMENT_UPLOAD_BYTES = 12 * 1024 * 1024;

export async function createProjectAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const name = String(formData.get("name") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const jobType = String(formData.get("jobType") ?? "").trim();
  const siteAddress = String(formData.get("siteAddress") ?? "").trim();
  const simpleScope = String(formData.get("simpleScope") ?? "").trim();

  if (!name) return { error: "Project name is required." };

  try {
    await apiFetch("/api/v1/projects", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        name,
        customerId: customerId || undefined,
        jobType: jobType || undefined,
        siteAddress: siteAddress || undefined,
        simpleScope: simpleScope || undefined,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath("/projects");
  redirect("/projects");
}

export async function updateProjectAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const id = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const jobType = String(formData.get("jobType") ?? "").trim();
  const siteAddress = String(formData.get("siteAddress") ?? "").trim();
  const simpleScope = String(formData.get("simpleScope") ?? "").trim();

  if (!name) return { error: "Project name is required." };

  try {
    await apiFetch(`/api/v1/projects/${id}`, {
      method: "PATCH",
      token: token ?? undefined,
      body: JSON.stringify({
        name,
        jobType: jobType || undefined,
        siteAddress: siteAddress || undefined,
        simpleScope: simpleScope || undefined,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

export async function updateProjectStatusAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const id = String(formData.get("projectId") ?? "");
  const status = String(formData.get("status") ?? "");

  await apiFetch(`/api/v1/projects/${id}/status`, {
    method: "PATCH",
    token: token ?? undefined,
    body: JSON.stringify({ status }),
  });

  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

export async function createEstimateAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");

  const estimate = await apiFetch<Estimate>("/api/v1/estimates", {
    method: "POST",
    token: token ?? undefined,
    body: JSON.stringify({ projectId }),
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/estimates/${estimate.id}`);
}

export async function duplicateEstimateAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const estimateId = String(formData.get("estimateId") ?? "");

  const estimate = await apiFetch<Estimate>(`/api/v1/estimates/${estimateId}/duplicate`, {
    method: "POST",
    token: token ?? undefined,
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/estimates/${estimate.id}`);
}

export async function createSiteVisitAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const transcript = String(formData.get("transcript") ?? "").trim();
  const squareFeet = String(formData.get("squareFeet") ?? "").trim();
  const linearFeet = String(formData.get("linearFeet") ?? "").trim();
  const fixtureCount = String(formData.get("fixtureCount") ?? "").trim();
  const arrivalAt = String(formData.get("arrivalAt") ?? "").trim();
  const departureAt = String(formData.get("departureAt") ?? "").trim();
  const gps = String(formData.get("gps") ?? "").trim();
  const customerNotes = String(formData.get("customerNotes") ?? "").trim();
  const materialsNeeded = splitTextareaLines(String(formData.get("materialsNeeded") ?? ""));
  const safetyNotes = splitTextareaLines(String(formData.get("safetyNotes") ?? ""));
  const punchList = splitTextareaLines(String(formData.get("punchList") ?? ""));

  const measurementsJson: Record<string, unknown> = {};
  if (squareFeet) measurementsJson.squareFeet = Number(squareFeet);
  if (linearFeet) measurementsJson.linearFeet = Number(linearFeet);
  if (fixtureCount) measurementsJson.fixtureCount = Number(fixtureCount);

  const photoFiles = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File)
    .filter((file) => file.size > 0);

  if (photoFiles.length > MAX_PROJECT_PHOTOS) {
    return { error: `Upload up to ${MAX_PROJECT_PHOTOS} project photos per intake save.` };
  }

  for (const file of photoFiles) {
    if (!file.type.startsWith("image/")) {
      return { error: "Project photo uploads must be image files." };
    }
    if (file.size > MAX_STANDARD_UPLOAD_BYTES) {
      return { error: `Each photo must be 6MB or smaller for this upload flow.` };
    }
  }

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "project-files";
  const uploadedEntries: Array<{ path: string; fileName: string }> = [];

  try {
    await apiFetch(`/api/v1/projects/${projectId}/site-visits`, {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        notes: notes || undefined,
        transcript: transcript || undefined,
        detailsJson: {
          ...(arrivalAt ? { arrivalAt: new Date(arrivalAt).toISOString() } : {}),
          ...(departureAt ? { departureAt: new Date(departureAt).toISOString() } : {}),
          ...(gps ? { gps } : {}),
          ...(customerNotes ? { customerNotes } : {}),
          ...(materialsNeeded.length ? { materialsNeeded } : {}),
          ...(safetyNotes.length ? { safetyNotes } : {}),
          ...(punchList.length ? { punchList } : {}),
          voiceNoteStatus: "captured_later",
        },
        measurementsJson: Object.keys(measurementsJson).length ? measurementsJson : undefined,
      }),
    });

    if (photoFiles.length > 0) {
      const supabase = await createSupabaseClient();

      for (const file of photoFiles) {
        const filePath = buildProjectFilePath(projectId, file.name);
        const fileBuffer = await file.arrayBuffer();
        const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, fileBuffer, {
          contentType: file.type || undefined,
          upsert: false,
        });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        uploadedEntries.push({ path: filePath, fileName: file.name });
      }
    }

    for (const entry of uploadedEntries) {
      const fileUrl = buildStorageObjectUrl(bucket, entry.path, isPublicStorageBucket());
      await apiFetch(`/api/v1/projects/${projectId}/files`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          fileType: "photo",
          fileUrl,
          fileName: entry.fileName,
          storagePath: entry.path,
        }),
      });
    }
  } catch (err) {
    if (uploadedEntries.length > 0) {
      const supabase = await createSupabaseClient();
      await supabase.storage.from(bucket).remove(uploadedEntries.map((entry) => entry.path));
    }
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/intake`);
}

export async function uploadProjectDocumentAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const fileType = String(formData.get("fileType") ?? "document").trim();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Select a file to upload." };
  }

  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return { error: "Each document must be 12MB or smaller." };
  }

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "project-files";
  const storagePath = buildProjectFilePath(projectId, file.name);

  try {
    const supabase = await createSupabaseClient();
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
      contentType: file.type || undefined,
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const fileUrl = buildStorageObjectUrl(bucket, storagePath, isPublicStorageBucket());
    await apiFetch(`/api/v1/projects/${projectId}/files`, {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        fileType,
        fileUrl,
        fileName: file.name,
        storagePath,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=documents`);
}

export async function createProjectTaskAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const assignedTo = String(formData.get("assignedTo") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const priority = String(formData.get("priority") ?? "medium").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!title) return { error: "Task title is required." };

  try {
    await apiFetch(`/api/v1/projects/${projectId}/tasks`, {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        title,
        assignedTo: assignedTo || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        priority,
        notes: notes || undefined,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=tasks`);
}

export async function updateProjectTaskStatusAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "");

  await apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
    method: "PATCH",
    token: token ?? undefined,
    body: JSON.stringify({ status }),
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=tasks`);
}

export async function deleteProjectTaskAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");

  await apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
    method: "DELETE",
    token: token ?? undefined,
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=tasks`);
}

export async function createChangeOrderAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const estimateId = String(formData.get("estimateId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const scheduleImpactDays = String(formData.get("scheduleImpactDays") ?? "").trim();

  if (!description) return { error: "Change order description is required." };

  try {
    await apiFetch(`/api/v1/change-orders`, {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        projectId,
        estimateId: estimateId || undefined,
        description,
        scheduleImpactDays: scheduleImpactDays ? Number(scheduleImpactDays) : undefined,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=change-orders`);
}

export async function addChangeOrderLineItemAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const changeOrderId = String(formData.get("changeOrderId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const quantity = String(formData.get("quantity") ?? "").trim();
  const unitCost = String(formData.get("unitCost") ?? "").trim();

  if (!description || !quantity || !unitCost) {
    return { error: "Description, quantity, and unit cost are required." };
  }

  try {
    await apiFetch(`/api/v1/change-orders/${changeOrderId}/line-items`, {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        description,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Something went wrong." };
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=change-orders`);
}

export async function approveChangeOrderAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const changeOrderId = String(formData.get("changeOrderId") ?? "");

  await apiFetch(`/api/v1/change-orders/${changeOrderId}/approve`, {
    method: "POST",
    token: token ?? undefined,
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=change-orders`);
}

export async function rejectChangeOrderAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const changeOrderId = String(formData.get("changeOrderId") ?? "");

  await apiFetch(`/api/v1/change-orders/${changeOrderId}/reject`, {
    method: "POST",
    token: token ?? undefined,
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=change-orders`);
}

export async function deleteProjectFileAction(formData: FormData): Promise<void> {
  const token = await getSessionToken();
  const projectId = String(formData.get("projectId") ?? "");
  const fileId = String(formData.get("fileId") ?? "");
  const storagePath = String(formData.get("storagePath") ?? "").trim();
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "project-files";

  if (storagePath) {
    const supabase = await createSupabaseClient();
    await supabase.storage.from(bucket).remove([storagePath]);
  }

  await apiFetch(`/api/v1/projects/${projectId}/files/${fileId}`, {
    method: "DELETE",
    token: token ?? undefined,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/intake`);
  redirect(`/projects/${projectId}/intake`);
}

function buildProjectFilePath(projectId: string, fileName: string) {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${projectId}/${crypto.randomUUID()}-${sanitizedName}`;
}

function splitTextareaLines(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
