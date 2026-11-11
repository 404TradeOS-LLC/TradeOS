// Only a persisted Project detail route may satisfy the create-project
// browser checkpoint. The app redirects straight to the new project detail
// page after creation; /projects/new is the form and /projects is the list,
// neither of which proves a Project was created.
const PROJECT_DETAIL_PATH = /^\/projects\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\/?$/i;

export function createdProjectIdFromUrl(value) {
  try {
    return PROJECT_DETAIL_PATH.exec(new URL(String(value)).pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}
