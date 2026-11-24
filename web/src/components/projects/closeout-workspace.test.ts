import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tabsUrl = new URL("./project-workspace-tabs.tsx", import.meta.url);
const workspaceUrl = new URL("./project-workspace.tsx", import.meta.url);
const formsUrl = new URL("./closeout-forms.tsx", import.meta.url);
const actionsUrl = new URL("../../app/actions/closeout.ts", import.meta.url);
const apiUrl = new URL("../../lib/api.ts", import.meta.url);

async function read(url: URL) {
  return readFile(url, "utf8");
}

test("closeout is a project workspace tab next to change orders", async () => {
  const tabs = await read(tabsUrl);
  assert.match(tabs, /"closeout",/);
  assert.match(tabs, /closeout: "Closeout",/);
  // The tab sits in the same list as the change-orders tab.
  assert.ok(tabs.indexOf('"change-orders"') < tabs.indexOf('"closeout"'));
});

test("closeout tab renders status, checklist states, and the document link", async () => {
  const source = await read(workspaceUrl);
  assert.match(source, /case "closeout":/);
  assert.match(source, /Closeout status/);
  assert.match(source, /Artifact checklist/);
  assert.match(source, /Present/);
  assert.match(source, /Missing/);
  assert.match(source, /Not applicable/);
  assert.match(source, /\/api\/documents\/closeout\/projects\/\$\{project\.id\}\/closeout\/document/);
  assert.match(source, /View closeout document/);
});

test("closeout tab shows the missing list and gates mark-ready on it", async () => {
  const source = await read(workspaceUrl);
  assert.match(source, /Not ready yet — still missing:/);
  assert.match(source, /missingForReady/);
  // The missing list is the backend's own verdict (checklist.missing),
  // rendered verbatim — the tab never recomputes readiness itself.
  assert.match(source, /checklist\?\.missing/);
  assert.match(source, /disabled=\{!checklist\.ready\}/);
  assert.match(source, /Mark ready/);
  // Record handoff renders only once the closeout is ready.
  assert.match(source, /closeout\.status === "ready" \? \(/);
  assert.match(source, /Record handoff/);
  // The four artifact rows are derived from the backend's named checks.
  assert.match(source, /buildCloseoutChecklistArtifacts\(checklist\)/);
});

test("closeout tab shows start-closeout when no record exists and surfaces the backend reason", async () => {
  const source = await read(workspaceUrl);
  assert.match(source, /CloseoutStartForm/);
  const forms = await read(formsUrl);
  assert.match(forms, /Start closeout/);
  assert.match(forms, /Closeout starts once a job on this project is completed/);
  const actions = await read(actionsUrl);
  assert.match(actions, /createCloseoutAction/);
  assert.match(actions, /err instanceof ApiClientError \? err\.message/);
});

test("punch list renders create form and resolve/verify/reopen actions", async () => {
  const source = await read(workspaceUrl);
  assert.match(source, /Punch list/);
  assert.match(source, /PunchItemCreateForm/);
  assert.match(source, /resolvePunchItemAction/);
  assert.match(source, /verifyPunchItemAction/);
  assert.match(source, /reopenPunchItemAction/);
  const forms = await read(formsUrl);
  const actions = await read(actionsUrl);
  assert.match(forms, /Add punch item/);
  assert.match(forms, /name="title"/);
  assert.match(forms, /name="priority"/);
  assert.match(forms, /name="assignedUserId"/);
  assert.match(forms, /name="dueDate"/);
  assert.match(forms, /name="jobId"/);
  // The backend's punch priority vocabulary is low/medium/high only —
  // "urgent" is rejected with a 400, so the form never offers it.
  assert.doesNotMatch(forms, /urgent/i);
  assert.doesNotMatch(actions, /"urgent"/);
});

test("warranty empty state is explicit and no default terms are ever filled in", async () => {
  const source = await read(workspaceUrl);
  assert.match(source, /No warranty recorded for this project/);
  const forms = await read(formsUrl);
  assert.match(forms, /Coverage as stated in the contract — quote it, do not paraphrase or invent/);
  assert.match(forms, /Record only a warranty the contractor actually gave\. No terms or dates are filled in for you/);
  assert.match(forms, /name="startsAt"/);
  assert.match(forms, /name="endsAt"/);
  assert.doesNotMatch(forms, /1 year|12 months?|2 years?|5 years?|default warranty|warranty by default/i);
  assert.doesNotMatch(source, /1 year|12 months?|2 years?|5 years?|default warranty/i);
});

test("closeout actions call the API contract through the existing server path", async () => {
  const actions = await read(actionsUrl);
  assert.match(actions, /\/api\/v1\/closeout\/projects\/\$\{encodeURIComponent\(projectId\)\}\/closeout/);
  assert.match(actions, /\/closeout\/ready/);
  assert.match(actions, /\/closeout\/handoff/);
  assert.match(actions, /\/punch-items/);
  assert.match(actions, /\/punch-items\/\$\{encodeURIComponent\(punchItemId\)\}\/\$\{transition\}/);
  assert.match(actions, /transitionPunchItem\(formData, "resolve"\)/);
  assert.match(actions, /transitionPunchItem\(formData, "verify"\)/);
  assert.match(actions, /transitionPunchItem\(formData, "reopen"\)/);
  assert.match(actions, /\/warranties/);
  assert.match(actions, /redirect\(`\/projects\/\$\{projectId\}\?tab=closeout`\)/);
  assert.doesNotMatch(actions, /fetch\(|clientFetch/);
  assert.match(actions, /apiFetch/);
  assert.match(actions, /getSessionToken/);
  // Date inputs yield bare dates; the backend's Zod schemas require full
  // datetimes, so actions convert them (same pattern as invoice dates).
  assert.match(actions, /dueDate: dueDate \? `\$\{dueDate\}T00:00:00\.000Z` : undefined/);
  assert.match(actions, /startsAt: startsAt \? `\$\{startsAt\}T00:00:00\.000Z` : undefined/);
  assert.match(actions, /endsAt: endsAt \? `\$\{endsAt\}T00:00:00\.000Z` : undefined/);
  // The picked source record is linked through the backend's typed fields.
  assert.match(actions, /contractId: sourceId/);
  assert.match(actions, /invoiceId: sourceId/);
});

test("punch priority vocabulary matches the backend (low/medium/high only)", async () => {
  const actions = await read(actionsUrl);
  const forms = await read(formsUrl);
  const api = await read(apiUrl);
  assert.match(actions, /\["low", "medium", "high"\]/);
  assert.match(api, /export type PunchItemPriority = "low" \| "medium" \| "high"/);
  assert.doesNotMatch(actions, /urgent/);
  assert.doesNotMatch(forms, /value="urgent"/);
  // ("urgent" still exists elsewhere in the codebase as a task/dashboard
  // severity — only the punch-item path must not offer it.)
});

test("closeout API client types match the backend contract and carry no invented defaults", async () => {
  const api = await read(apiUrl);
  assert.match(api, /export type CloseoutStatus = "draft" \| "ready" \| "handed_off"/);
  assert.match(api, /export type CloseoutArtifactState = "present" \| "missing" \| "not_applicable"/);
  assert.match(api, /export type PunchItemStatus = "open" \| "in_progress" \| "resolved" \| "verified"/);
  assert.match(api, /export type WarrantySourceType = "contract" \| "invoice" \| "other"/);
  assert.match(api, /getProjectCloseout\(token: string, projectId: string\)/);
  assert.match(api, /listPunchItems\(token: string, projectId: string\)/);
  assert.match(api, /listWarranties\(token: string, projectId: string\)/);
  assert.match(api, /closeout\?: PortalCloseoutHandoff \| null/);
  // GET .../closeout returns { closeout, checklist } as one payload: the
  // checklist is separate from the row, with the backend's four named
  // checks — completed jobs, signed contract, final invoice, accepted
  // proposal — plus the backend's own `missing` verdict. The row carries
  // no checklist and no `readyAt` (the ready timestamp is `completedAt`).
  assert.match(api, /export interface GetProjectCloseoutResult/);
  assert.match(api, /completedJobs: \{ count: number; ids: string\[\] \}/);
  assert.match(api, /signedContract: \{ present: boolean; contractId: string \| null \}/);
  assert.match(api, /finalInvoice: \{ present: boolean; invoiceId: string \| null \}/);
  assert.match(api, /acceptedProposal: \{ status: "present" \| "missing" \| "not_applicable"; proposalId: string \| null \}/);
  assert.match(api, /missing: string\[\]/);
  assert.match(api, /completedAt: string \| null/);
  assert.match(api, /export function buildCloseoutChecklistArtifacts\(checklist: CloseoutChecklist\)/);
  assert.doesNotMatch(api, /readyAt/);
  // The closeout row itself carries no checklist — it arrives alongside
  // the row in GetProjectCloseoutResult. (The portal handoff type still
  // carries its own `checklist` field; that is the handoff shape, not the row.)
  assert.doesNotMatch(api, /interface ProjectCloseout \{[^}]*checklist/s);
});
