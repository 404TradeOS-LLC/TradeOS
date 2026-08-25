import "server-only";
import type { OrganizationSettingsResponse } from "@/lib/settings";
import type { BrandAsset, BrandDocumentSettings, BrandProfile, BrandStudioPreview } from "@/lib/brand-studio";
import { buildEstimateQueueSearchParams, buildInvoiceQueueSearchParams, buildProposalQueueSearchParams } from "@/lib/work-queue-params";
import { buildCostbookQuery, type CostbookListParams } from "@/lib/costbook-query";
import {
  contractStatuses,
  estimateStatuses,
  invoiceStatuses,
  legacyContractStatusMap,
  legacyEstimateStatusMap,
  legacyInvoiceStatusMap,
  legacyProjectStatusMap,
  legacyProposalStatusMap,
  projectStatuses,
  proposalStatuses,
  type ChangeOrderStatus,
  type ContractStatus,
  type EstimateStatus,
  type InvoiceStatus,
  type JobStatus,
  type ProjectStatus,
  type ProposalStatus,
  type TaskStatus,
} from "@/domain";

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

// The backend's canonical domain model (app/domain/contracts.ts) defines the
// target status vocabulary, but not every service has finished migrating its
// writes to it yet (e.g. contracts still default to the legacy
// "pending_signature" instead of "sent", proposals still write "rejected"
// instead of "declined" — see docs/DOMAIN_MODEL_CANONICAL.md's compatibility
// notes). Normalize defensively at the API boundary using the existing
// legacy maps rather than trusting every raw value is already canonical.
function normalizeStatus<T extends string>(status: string, legacyMap: Record<string, T>, canonical: readonly T[], fallback: T): T {
  if ((canonical as readonly string[]).includes(status)) return status as T;
  return legacyMap[status] ?? fallback;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface ApiFetchOptions extends RequestInit {
  token?: string;
}

// Server-only fetch wrapper around the Express API. Centralizes the
// Authorization header and the error-shape parsing for the backend's
// consistent { error, details? } JSON error responses (see errorHandler.ts).
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const response = await fetch(`${BACKEND_API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ApiClientError(body?.error ?? "Request failed", response.status, body?.details);
  }

  return body as T;
}

export function getOrganizationSettings(token: string) {
  return apiFetch<OrganizationSettingsResponse>("/api/v1/settings", { token });
}

export type SettingsAssetKey = "logoUrl" | "darkLogoUrl" | "iconUrl" | "watermarkUrl";

export interface SettingsAssetUploadResponse {
  assetKey: SettingsAssetKey;
  storageBucket: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface RecordSettingsAssetUploadResponse {
  current: SettingsAssetUploadResponse;
  previous: SettingsAssetUploadResponse | null;
}

// Server-only lookup used by the brand-asset proxy route to resolve where an
// asset's bytes currently live before streaming them via the service_role
// Supabase client. Returns null (never throws) when nothing has been
// uploaded for that slot yet, matching the proxy route's 404-as-empty-state
// handling.
export async function getSettingsAssetUpload(token: string, assetKey: SettingsAssetKey) {
  try {
    return await apiFetch<SettingsAssetUploadResponse>(`/api/v1/settings/assets/${assetKey}`, { token });
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) return null;
    throw err;
  }
}

// Persists new storage metadata after the caller has already uploaded bytes
// to Supabase Storage via the service_role client. Returns the previous
// record (if any) so the caller can delete the now-superseded object.
export function recordSettingsAssetUpload(
  token: string,
  input: { assetKey: SettingsAssetKey; storageBucket: string; storagePath: string; contentType: string; sizeBytes: number }
) {
  return apiFetch<RecordSettingsAssetUploadResponse>("/api/v1/settings/assets", {
    token,
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Deletes the metadata row for an explicit "Remove" action. Returns the
// deleted record (if any) so the caller can delete the underlying storage
// object; a no-op-shaped response if nothing was set.
export function clearSettingsAssetUpload(token: string, assetKey: SettingsAssetKey) {
  return apiFetch<{ cleared: SettingsAssetUploadResponse | null }>(`/api/v1/settings/assets/${assetKey}`, {
    token,
    method: "DELETE",
  });
}

export function getBrandStudioProfile(token: string) {
  return apiFetch<BrandProfile>("/api/v1/brand-studio/profile", { token });
}

export function getBrandStudioAssets(token: string) {
  return apiFetch<BrandAsset[]>("/api/v1/brand-studio/assets", { token });
}

export function getBrandStudioDocumentSettings(token: string) {
  return apiFetch<BrandDocumentSettings>("/api/v1/brand-studio/document-settings", { token });
}

export function getBrandStudioPreview(token: string) {
  return apiFetch<BrandStudioPreview>("/api/v1/brand-studio/preview", { token });
}

export interface CostbookWorkspaceSummary {
  organizationId: string;
  initialized: boolean;
  status: "foundation" | "active" | "archived";
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    canManage: boolean;
  };
  counts: {
    categories: number;
    costItems: number;
    laborRates: number;
    materials: number;
    equipment: number;
    assemblies: number;
  };
  areas: {
    id: "materials" | "labor" | "equipment" | "assemblies" | "pricing-rules" | "price-history";
    label: string;
    description: string;
    status: "existing_catalog" | "foundation_only" | "future";
  }[];
}

export function getCostbookWorkspace(token: string) {
  return apiFetch<CostbookWorkspaceSummary>("/api/v1/costbook/workspace", { token });
}

export interface CostbookMaterial {
  id: string;
  organizationId: string;
  sku: string | null;
  name: string;
  unitOfMeasure: string;
  unitCost: number;
  wasteFactorPct: number;
  supplierId: string | null;
  supplierName: string | null;
  lastPriceUpdate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CostbookMaterialInput {
  sku?: string | null;
  name: string;
  unitOfMeasure: string;
  unitCost: number;
  wasteFactorPct?: number;
  supplierId?: string | null;
}

export interface CatalogPage<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

export function listCostbookMaterials(token: string, params: CostbookListParams = {}) {
  return apiFetch<CatalogPage<CostbookMaterial>>(`/api/v1/costbook/materials${buildCostbookQuery(params)}`, { token });
}

export interface CostbookLaborRate {
  id: string;
  organizationId: string;
  role: string;
  description: string | null;
  hourlyCost: number;
  billRate: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CostbookLaborRateInput {
  role: string;
  description?: string | null;
  hourlyCost: number;
  billRate: number;
  active?: boolean;
}

export function listCostbookLaborRates(token: string, params: CostbookListParams = {}) {
  return apiFetch<CatalogPage<CostbookLaborRate>>(`/api/v1/costbook/labor-rates${buildCostbookQuery(params)}`, { token });
}

export interface CostbookDivision {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CostbookDivisionInput {
  code: string;
  name: string;
  sortOrder?: number;
}

export function listCostbookDivisions(token: string, params: CostbookListParams = {}) {
  return apiFetch<CatalogPage<CostbookDivision>>(`/api/v1/costbook/divisions${buildCostbookQuery(params)}`, { token });
}

export interface CostbookCategory {
  id: string;
  divisionId: string;
  organizationId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CostbookCategoryInput {
  divisionId: string;
  code: string;
  name: string;
  sortOrder?: number;
}

export function listCostbookCategories(token: string, params: CostbookListParams = {}) {
  return apiFetch<CatalogPage<CostbookCategory>>(`/api/v1/costbook/categories${buildCostbookQuery(params)}`, { token });
}

export interface CostbookSubcategory {
  id: string;
  categoryId: string;
  organizationId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CostbookSubcategoryInput {
  categoryId: string;
  code: string;
  name: string;
  sortOrder?: number;
}

export function listCostbookSubcategories(token: string, params: CostbookListParams = {}) {
  return apiFetch<CatalogPage<CostbookSubcategory>>(`/api/v1/costbook/subcategories${buildCostbookQuery(params)}`, { token });
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  billingAddress: string | null;
  notes: string | null;
  createdAt: string;
}

export function listCustomers(token: string) {
  return apiFetch<Customer[]>("/api/v1/customers", { token });
}

export function getCustomer(token: string, id: string) {
  return apiFetch<Customer & { projects: Project[] }>(`/api/v1/customers/${id}`, { token });
}

export const PROJECT_STATUSES = projectStatuses;
export type { ProjectStatus };

export interface Project {
  id: string;
  orgId: string | null;
  customerId: string | null;
  name: string;
  title?: string;
  jobType: string | null;
  siteAddress: string | null;
  projectAddress?: string | null;
  simpleScope: string | null;
  regionId: string | null;
  status: ProjectStatus;
  createdAt: string;
}

export interface SiteVisit {
  id: string;
  transcript: string | null;
  notes: string | null;
  detailsJson: {
    arrivalAt?: string;
    departureAt?: string;
    gps?: string;
    customerNotes?: string;
    materialsNeeded?: string[];
    safetyNotes?: string[];
    punchList?: string[];
    voiceNoteStatus?: "not_recorded" | "captured_later";
  } | null;
  measurementsJson: Record<string, unknown> | null;
  aiQuestionsJson: string[] | null;
  missingInfoJson: string[] | null;
  confidenceScore: number | null;
  createdAt: string;
}

export interface ProjectFile {
  id: string;
  fileType: string;
  fileUrl: string;
  fileName: string;
  storagePath: string | null;
  createdAt: string;
}

export function listProjects(token: string) {
  return apiFetch<Project[]>("/api/v1/projects", { token }).then((projects) =>
    projects.map((project) => ({ ...project, status: normalizeStatus(project.status, legacyProjectStatusMap, projectStatuses, "lead") }))
  );
}

export interface JobSummary {
  id: string;
  jobNumber: string;
  title: string;
  jobType: string;
  status: JobStatus;
  priority: "low" | "medium" | "high" | "urgent";
  scheduledStart: string | null;
  scheduledEnd: string | null;
  archivedAt: string | null;
}

export function listJobsByProject(token: string, projectId: string) {
  return apiFetch<{ items: JobSummary[]; page: number; pageSize: number; total: number }>(
    `/api/v1/jobs?projectId=${projectId}`,
    { token }
  );
}

export interface ScheduleConflict {
  type: "technician_overlap";
  technicianId: string;
  technicianName: string | null;
  conflictingJobId: string;
  conflictingJobNumber: string;
  conflictingJobTitle: string;
  conflictingScheduledStart: string;
  conflictingScheduledEnd: string;
}

export interface ScheduleConflictResult {
  conflicts: ScheduleConflict[];
  overrideAllowed: boolean;
}

export interface Estimate {
  id: string;
  projectId: string;
  version: number;
  status: EstimateStatus;
  overheadPct: number;
  profitPct: number;
  targetMarginPct: number | null;
  taxPct: number;
  taxAmount: number;
  costAfterOverhead: number;
  preTaxTotalPrice: number;
  subtotalCost: number;
  totalPrice: number;
  createdAt?: string;
}

export interface EstimateLineItem {
  id: string;
  estimateId: string;
  costItemId: string | null;
  assemblyId: string | null;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitCost: number;
  lineCost: number;
  sortOrder: number;
  section: string;
  costType: "labor" | "material" | "equipment" | "disposal" | "subcontractor" | "other";
  taxable: boolean;
}

export type EstimateDetail = Estimate & { lineItems: EstimateLineItem[] };

export function listEstimatesByProject(token: string, projectId: string) {
  return apiFetch<Estimate[]>(`/api/v1/estimates/by-project/${projectId}`, { token }).then((estimates) =>
    estimates.map((estimate) => ({ ...estimate, status: normalizeStatus(estimate.status, legacyEstimateStatusMap, estimateStatuses, "draft") }))
  );
}

/**
 * Retrieves an estimate by ID with its status normalized to a canonical value.
 *
 * @param id - The estimate ID
 * @returns The estimate details with a canonical status
 */
export function getEstimate(token: string, id: string) {
  return apiFetch<EstimateDetail>(`/api/v1/estimates/${id}`, { token }).then((estimate) => ({
    ...estimate,
    status: normalizeStatus(estimate.status, legacyEstimateStatusMap, estimateStatuses, "draft"),
  }));
}

// --- Organization work-queue reads (PR #251) ---
//
// Reusable, organization-scoped, paginated read endpoints — the router root
// for each resource, distinct from the existing `/by-project/:projectId` and
// `/:id` routes on the same router. Intended for dashboard "needs attention"
// views, reporting surfaces, and future Athena tools that need a
// company-wide queue rather than a single project's documents. Shared
// envelope/pagination contract across all three: opaque cursor, default
// limit 25, max 50, `updatedAt desc, id desc` ordering, exact filtered
// `total`. See docs/API_REFERENCE.md and docs/modules/{estimating,proposals,
// invoices-and-payments}.md for the full per-resource contract.

export interface WorkQueueResponse<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

export interface EstimateQueueItem {
  id: string;
  projectId: string;
  projectName: string;
  customerName: string | null;
  status: EstimateStatus;
  amount: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface EstimateQueueParams {
  status?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Lists organization-wide estimates in a paginated work queue.
 *
 * @param params - Optional filters and pagination settings for the queue
 * @returns The paginated estimate queue with canonical estimate statuses
 */
export function listEstimateQueue(token: string, params: EstimateQueueParams = {}) {
  const qs = buildEstimateQueueSearchParams(params).toString();

  return apiFetch<WorkQueueResponse<EstimateQueueItem>>(`/api/v1/estimates${qs ? `?${qs}` : ""}`, { token }).then((response) => ({
    ...response,
    items: response.items.map((item) => ({ ...item, status: normalizeStatus(item.status, legacyEstimateStatusMap, estimateStatuses, "draft") })),
  }));
}

export interface AIEstimateSuggestion {
  id: string;
  kind: "assembly" | "costItem";
  code: string;
  title: string;
  rationale: string;
  quantity: number;
  unit: string;
  confidence: number;
  resolution: {
    status: "resolved" | "unresolved";
    reason: string;
    target: {
      id: string;
      kind: "assembly" | "costItem";
      code: string;
      name: string;
      unitOfMeasure: string;
      matchMethod: "id" | "exact-name" | "contains-name";
      matchScore: number;
    } | null;
  };
}

export function getAIEstimateSuggestions(token: string, estimateId: string, scopeOfWork: string) {
  return apiFetch<{ scopeOfWork: string; suggestions: AIEstimateSuggestion[]; knowledgeMatch: KnowledgeScopeMatch }>(
    `/api/v1/estimates/${estimateId}/ai-suggestions`,
    {
      token,
      method: "POST",
      body: JSON.stringify({ scopeOfWork }),
    }
  );
}

export function applyAIEstimateSuggestions(
  token: string,
  estimateId: string,
  suggestions: Array<{
    id: string;
    kind: "assembly" | "costItem";
    title: string;
    quantity: number;
    status: "pending" | "accepted" | "rejected";
    description?: string;
    targetId?: string;
    targetKind?: "assembly" | "costItem";
  }>
) {
  return apiFetch<{
    applied: Array<{ suggestionId: string; lineItemId: string; title: string; quantity: number }>;
    skipped: Array<{ suggestionId: string; title: string; status: "pending" | "accepted" | "rejected"; reason: string }>;
  }>(`/api/v1/estimates/${estimateId}/ai-suggestions/apply`, {
    token,
    method: "POST",
    body: JSON.stringify({ suggestions }),
  });
}

export interface KnowledgeStats {
  readOnly: true;
  assembliesCount: number;
  costItemsCount: number;
  tradesCount: number;
  schemaCount: number;
  indexedKeywordCount: number;
  sourceFileCount: number;
  loadWarnings: string[];
  sources: {
    exportsDir: string;
    knowledgeDir: string;
    schemasDir: string;
  };
}

export interface KnowledgeTrade {
  id: string;
  name: string;
  itemCount: number;
  status: string;
  coverage: string;
  notes: string;
  keywords: string[];
}

export interface KnowledgeSearchResult {
  id: string;
  type: "assembly" | "costItem";
  name: string;
  category: string;
  trade: string | null;
  unitOfMeasure: string | null;
  description: string;
  confidence: number;
  matchedKeywords: string[];
  rationale: string;
  metadata: Record<string, unknown>;
}

export interface KnowledgeScopeMatch {
  detectedTrade: string | null;
  confidenceScore: number;
  assumptions: string[];
  rationale: string[];
  missingInformation: string[];
  reviewWarnings: string[];
  missingInputs: string[];
  humanReviewWarnings: string[];
  matchedAssemblies: KnowledgeSearchResult[];
  matchedCostItems: KnowledgeSearchResult[];
}

export function getKnowledgeStats(token: string) {
  return apiFetch<KnowledgeStats>("/api/v1/knowledge/stats", { token });
}

export function getKnowledgeTrades(token: string) {
  return apiFetch<KnowledgeTrade[]>("/api/v1/knowledge/trades", { token });
}

export function getKnowledgeMatchScope(token: string, scopeText: string) {
  return apiFetch<KnowledgeScopeMatch>("/api/v1/knowledge/match", {
    token,
    method: "POST",
    body: JSON.stringify({ scopeText }),
  });
}

export function searchKnowledge(token: string, input: { query: string; type?: "assembly" | "costItem" | "all"; trade?: string; limit?: number }) {
  const params = new URLSearchParams();
  params.set("q", input.query);
  if (input.type) params.set("type", input.type);
  if (input.trade) params.set("trade", input.trade);
  if (input.limit) params.set("limit", String(input.limit));

  return apiFetch<KnowledgeSearchResult[]>(`/api/v1/knowledge/search?${params.toString()}`, { token });
}

export function getProject(token: string, id: string) {
  return apiFetch<
    Project & {
      customer: Customer | null;
      estimates: Estimate[];
      siteVisits: SiteVisit[];
      projectFiles: ProjectFile[];
      proposals: Proposal[];
      invoices: Array<Invoice & { lineItems: InvoiceLineItem[] }>;
      contracts: Contract[];
      changeOrders: Array<ChangeOrder & { lineItems: ChangeOrderLineItem[] }>;
      tasks: ProjectTask[];
      jobs: JobSummary[];
    }
  >(`/api/v1/projects/${id}`, { token }).then((project) => ({
    ...project,
    status: normalizeStatus(project.status, legacyProjectStatusMap, projectStatuses, "lead"),
    estimates: project.estimates.map((estimate) => ({ ...estimate, status: normalizeStatus(estimate.status, legacyEstimateStatusMap, estimateStatuses, "draft") })),
    proposals: project.proposals.map((proposal) => ({ ...proposal, status: normalizeStatus(proposal.status, legacyProposalStatusMap, proposalStatuses, "draft") })),
    invoices: project.invoices.map((invoice) => ({ ...invoice, status: normalizeStatus(invoice.status, legacyInvoiceStatusMap, invoiceStatuses, "draft") })),
    contracts: project.contracts.map((contract) => ({ ...contract, status: normalizeStatus(contract.status, legacyContractStatusMap, contractStatuses, "draft") })),
    jobs: project.jobs ?? [],
  }));
}

export interface ChangeOrder {
  id: string;
  projectId: string;
  estimateId: string | null;
  coNumber: number;
  description: string;
  status: ChangeOrderStatus;
  amount: number;
  scheduleImpactDays: number | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeOrderLineItem {
  id: string;
  changeOrderId: string;
  costItemId: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  lineCost: number;
  sortOrder: number;
}

export function listChangeOrdersByProject(token: string, projectId: string) {
  return apiFetch<ChangeOrder[]>(`/api/v1/change-orders/by-project/${projectId}`, { token });
}

export function getChangeOrder(token: string, id: string) {
  return apiFetch<ChangeOrder & { lineItems: ChangeOrderLineItem[] }>(`/api/v1/change-orders/${id}`, { token });
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  assignedTo: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationProjectTask extends ProjectTask {
  projectName: string;
  projectStatus: ProjectStatus;
  customerName: string | null;
  jobTitle: string | null;
}

export interface ActivityEvent {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  title: string;
  description: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
}

export function listProjectTasks(token: string, projectId: string) {
  return apiFetch<ProjectTask[]>(`/api/v1/projects/${projectId}/tasks`, { token });
}

export function listOrganizationProjectTasks(
  token: string,
  input: {
    limit?: number;
    includeCompleted?: boolean;
  } = {}
) {
  const params = new URLSearchParams();
  if (input.limit) params.set("limit", String(input.limit));
  if (input.includeCompleted !== undefined) params.set("includeCompleted", String(input.includeCompleted));

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return apiFetch<OrganizationProjectTask[]>(`/api/v1/projects/tasks${suffix}`, { token }).then((tasks) =>
    tasks.map((task) => ({
      ...task,
      projectStatus: normalizeStatus(task.projectStatus, legacyProjectStatusMap, projectStatuses, "lead"),
    }))
  );
}

export function listActivityEvents(
  token: string,
  input: {
    entityType?: string;
    entityId?: string;
    eventType?: string;
    limit?: number;
  } = {}
) {
  const params = new URLSearchParams();
  if (input.entityType) params.set("entityType", input.entityType);
  if (input.entityId) params.set("entityId", input.entityId);
  if (input.eventType) params.set("eventType", input.eventType);
  if (input.limit) params.set("limit", String(input.limit));

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return apiFetch<ActivityEvent[]>(`/api/v1/intelligence/activity${suffix}`, { token });
}

export interface ProposalDelivery {
  id: string;
  proposalId: string;
  eventType: string;
  deliveryChannel: string;
  recipientEmail: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  projectId: string;
  estimateId: string | null;
  status: ProposalStatus;
  companyName: string | null;
  showLineItemDetail: boolean;
  scopeOfWork: string | null;
  assumptions: string | null;
  exclusions: string | null;
  timeline: string | null;
  priceLow: number | null;
  priceHigh: number | null;
  finalPrice: number | null;
  paymentScheduleJson: unknown;
  pdfUrl: string | null;
  termsAndConditions: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  deliveries: ProposalDelivery[];
}

export interface ProposalPaymentScheduleEntry {
  label: string;
  amountPercent: number;
  notes?: string;
}

export interface ProposalDraftPreview {
  companyName: string;
  normalizedJobType: string | null;
  confidenceScore: number | null;
  missingInfo: string[];
  aiQuestions: string[];
  scopeOfWork: string;
  assumptions: string;
  exclusions: string;
  timeline: string;
  priceLow: number | null;
  priceHigh: number | null;
  paymentSchedule: ProposalPaymentScheduleEntry[];
}

export function getProposal(token: string, id: string) {
  return apiFetch<Proposal>(`/api/v1/proposals/${id}`, { token }).then((proposal) => ({
    ...proposal,
    status: normalizeStatus(proposal.status, legacyProposalStatusMap, proposalStatuses, "draft"),
  }));
}

/**
 * Retrieves the proposal draft preview for a project.
 *
 * @param projectId - The identifier of the project
 * @returns The project's proposal draft preview
 */
export function getProjectProposalDraft(token: string, projectId: string) {
  return apiFetch<ProposalDraftPreview>(`/api/v1/proposals/project-draft/${projectId}`, { token });
}

export interface ProposalQueueItem {
  id: string;
  projectId: string;
  projectName: string;
  customerName: string | null;
  status: ProposalStatus;
  amount: number | null;
  contractId: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  updatedAt: string;
}

export interface ProposalQueueParams {
  status?: string;
  sent?: boolean;
  viewed?: boolean;
  unsigned?: boolean;
  staleBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Lists organization-wide proposals matching the specified queue filters.
 *
 * @param params - Optional filters and pagination settings for the proposal queue
 * @returns A paginated proposal queue with canonical proposal statuses
 */
export function listProposalQueue(token: string, params: ProposalQueueParams = {}) {
  const qs = buildProposalQueueSearchParams(params).toString();

  return apiFetch<WorkQueueResponse<ProposalQueueItem>>(`/api/v1/proposals${qs ? `?${qs}` : ""}`, { token }).then((response) => ({
    ...response,
    items: response.items.map((item) => ({ ...item, status: normalizeStatus(item.status, legacyProposalStatusMap, proposalStatuses, "draft") })),
  }));
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitCost: number;
  lineCost: number;
}

export interface InvoiceDelivery {
  id: string;
  eventType: string;
  deliveryChannel: string;
  recipientEmail: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  paymentDate: string;
  method: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  projectId: string;
  estimateId: string | null;
  proposalId: string | null;
  invoiceNumber: number;
  type: "full" | "progress";
  status: InvoiceStatus;
  percentComplete: number | null;
  amount: number;
  dueDate: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
  paidAmount: number;
  balanceDue: number;
  payments: InvoicePayment[];
  deliveries: InvoiceDelivery[];
}

/**
 * Retrieves an invoice and its line items.
 *
 * @param id - The invoice identifier
 * @returns The invoice with its status normalized to a canonical value
 */
export function getInvoice(token: string, id: string) {
  return apiFetch<Invoice & { lineItems: InvoiceLineItem[] }>(`/api/v1/invoices/${id}`, { token }).then((invoice) => ({
    ...invoice,
    status: normalizeStatus(invoice.status, legacyInvoiceStatusMap, invoiceStatuses, "draft"),
  }));
}

export interface InvoiceQueueItem {
  id: string;
  documentNumber: number;
  projectId: string;
  projectName: string;
  customerName: string | null;
  status: InvoiceStatus;
  amount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate: string | null;
  updatedAt: string;
}

export interface InvoiceQueueParams {
  status?: string;
  sent?: boolean;
  overdue?: boolean;
  partiallyPaid?: boolean;
  unpaid?: boolean;
  updatedAfter?: string;
  updatedBefore?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Lists invoices in the organization work queue.
 *
 * @param params - Optional filters and pagination settings for the queue
 * @returns A paginated invoice queue with canonical invoice statuses
 */
export function listInvoiceQueue(token: string, params: InvoiceQueueParams = {}) {
  const qs = buildInvoiceQueueSearchParams(params).toString();

  return apiFetch<WorkQueueResponse<InvoiceQueueItem>>(`/api/v1/invoices${qs ? `?${qs}` : ""}`, { token }).then((response) => ({
    ...response,
    items: response.items.map((item) => ({ ...item, status: normalizeStatus(item.status, legacyInvoiceStatusMap, invoiceStatuses, "draft") })),
  }));
}

export interface ContractEvent {
  id: string;
  eventType: string;
  actorUserId: string | null;
  recipientEmail: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  projectId: string;
  proposalId: string;
  status: ContractStatus;
  termsText: string;
  signerName: string | null;
  signerEmail: string | null;
  signatureDataUrl: string | null;
  signatureIp: string | null;
  signedAt: string | null;
  createdAt: string;
  events: ContractEvent[];
}

export function listContractsByProject(token: string, projectId: string) {
  return apiFetch<Contract[]>(`/api/v1/contracts/by-project/${projectId}`, { token }).then((contracts) =>
    contracts.map((contract) => ({ ...contract, status: normalizeStatus(contract.status, legacyContractStatusMap, contractStatuses, "draft") }))
  );
}

export function getContract(token: string, id: string) {
  return apiFetch<Contract>(`/api/v1/contracts/${id}`, { token }).then((contract) => ({
    ...contract,
    status: normalizeStatus(contract.status, legacyContractStatusMap, contractStatuses, "draft"),
  }));
}

// --- Dispatcher Workspace ---
//
// Consumes the jobs list/summary endpoints described in the dispatcher
// workspace API contract. These job records are additive/separate from
// `JobSummary` above (which is scoped to a single project's job list) - the
// dispatch list is org-wide, paginated, and carries project/customer/
// technician context the project-scoped summary does not.

export interface DispatchJobTechnician {
  assignmentId?: string;
  userId: string;
  name: string;
}

export interface DispatchJob {
  id: string;
  jobNumber: string;
  title: string;
  status: JobStatus;
  priority: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  project: { id: string; name: string; siteAddress: string | null } | null;
  customer: { id: string; name: string } | null;
  assignedTechnicians: DispatchJobTechnician[];
  isOverdue: boolean;
  isUnassigned: boolean;
  needsAttention: boolean;
}

export interface DispatchJobListResponse {
  items: DispatchJob[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DispatchJobListParams {
  status?: string;
  priority?: string;
  technicianId?: string;
  unassigned?: boolean;
  needsAttention?: boolean;
  scheduledFrom?: string;
  scheduledTo?: string;
  projectId?: string;
  customerId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function listJobsForDispatch(token: string, params: DispatchJobListParams = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.priority) query.set("priority", params.priority);
  if (params.technicianId) query.set("technicianId", params.technicianId);
  if (params.unassigned != null) query.set("unassigned", String(params.unassigned));
  if (params.needsAttention != null) query.set("needsAttention", String(params.needsAttention));
  if (params.scheduledFrom) query.set("scheduledFrom", params.scheduledFrom);
  if (params.scheduledTo) query.set("scheduledTo", params.scheduledTo);
  if (params.projectId) query.set("projectId", params.projectId);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.search) query.set("search", params.search);
  if (params.page != null) query.set("page", String(params.page));
  if (params.pageSize != null) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();

  return apiFetch<DispatchJobListResponse>(`/api/v1/jobs${qs ? `?${qs}` : ""}`, { token });
}

export interface DispatchSummary {
  activeJobs: number;
  unscheduledJobs: number;
  scheduledToday: number;
  overdueActionable: number;
  needsAttention: number;
  timezone: { source: "organization" | "utc_fallback"; value: string };
  todayRangeUtc: { start: string; end: string };
  weekRangeUtc: { start: string; end: string };
  generatedAt: string;
  // Honest labeling for whether these counts are org-wide or narrowed to
  // only the caller's assigned jobs (the backend's jobs-table RLS policy
  // narrows non-owner/admin/dispatcher callers automatically - see
  // DispatchSummaryDTO in app/modules/jobs/types.ts).
  scope: { source: "organization" | "assigned_only"; role: string };
}

export function getDispatchSummary(token: string) {
  return apiFetch<DispatchSummary>("/api/v1/jobs/dispatch-summary", { token });
}

// dispatchRules.getOrgDayBoundaryUtc/getRollingWindowUtc (backend) document
// `end` as an EXCLUSIVE upper bound (the start of the next day/window),
// matching how JobsService.getDispatchSummary itself queries
// `scheduledStart: { lt: todayEnd }`. But GET /api/v1/jobs's `scheduledTo`
// filter (buildJobWhere's `scheduledStart: { lte: filters.scheduledTo }`) is
// INCLUSIVE. Passing the exclusive boundary straight through would let a job
// scheduled at exactly local midnight of the next day slip into "today"/"this
// week". Subtract 1ms to convert the exclusive boundary into the inclusive
// one this endpoint actually expects. Shared by any caller that turns a
// DispatchSummary range into a listJobsForDispatch scheduledTo filter.
export function toInclusiveEndBoundary(exclusiveEndIso: string): string {
  return new Date(new Date(exclusiveEndIso).getTime() - 1).toISOString();
}

// --- Athena Observability (A10) ---
//
// Read-only reporting surface over app/modules/athena-observability/types.ts
// (the backend's source of truth - these interfaces are mirrored, not
// imported, since web/ and app/ are separate workspaces). Every shape here
// matches that file field-for-field. All endpoints are mounted at
// /api/v1/athena/observability and require an owner/admin session - see
// web/src/lib/athena-access.ts for the role-gating helper every Athena page
// uses before calling any of these.

export const athenaKernelStates = [
  "created",
  "context_building",
  "routing",
  "planning",
  "policy_check",
  "awaiting_approval",
  "executing",
  "degraded",
  "needs_clarification",
  "partially_succeeded",
  "succeeded",
  "failed",
  "denied",
  "expired",
  "cancelled",
] as const;
export type AthenaKernelState = (typeof athenaKernelStates)[number];

export const athenaTelemetrySpanTypes = ["kernel", "context", "planner", "tool", "action", "approval", "memory", "event", "model"] as const;
export type AthenaTelemetrySpanType = (typeof athenaTelemetrySpanTypes)[number];
export type AthenaTelemetryStatus = "ok" | "error" | "denied" | "degraded";
export type AthenaTelemetryRedaction = "none" | "metadata_only" | "field_redacted" | "payload_omitted";

export interface AthenaTelemetryCost {
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedUsd?: number;
}

export interface AthenaTelemetrySpan {
  id: string;
  orgId: string;
  executionId: string;
  requestId: string;
  traceId: string;
  spanType: AthenaTelemetrySpanType;
  status: AthenaTelemetryStatus;
  durationMs: number;
  redaction: AthenaTelemetryRedaction;
  cost: AthenaTelemetryCost | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AthenaTraceExecutionSummary {
  executionId: string;
  orgId: string;
  requestId: string;
  traceId: string;
  actorUserId: string;
  canonicalRole: string;
  requestSource: string;
  state: AthenaKernelState;
  roundTrips: number;
  safeSummary: string | null;
  safeErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AthenaTraceTransition {
  fromState: AthenaKernelState | null;
  toState: AthenaKernelState;
  reasonCode: string;
  createdAt: string;
}

export interface AthenaTraceCompleteness {
  expectedSpanTypes: AthenaTelemetrySpanType[];
  observedSpanTypes: AthenaTelemetrySpanType[];
  missingSpanTypes: AthenaTelemetrySpanType[];
  score: number;
}

export interface AthenaTraceDetail {
  execution: AthenaTraceExecutionSummary;
  transitions: AthenaTraceTransition[];
  spans: AthenaTelemetrySpan[];
  completeness: AthenaTraceCompleteness;
}

export interface AthenaTraceSearchResultRow {
  execution: AthenaTraceExecutionSummary;
  spanCount: number;
  errorSpanCount: number;
  totalCostUsd: number | null;
}

export interface AthenaTraceSearchResult {
  rows: AthenaTraceSearchResultRow[];
  nextCursor: string | null;
}

export interface AthenaTraceSearchParams {
  traceId?: string;
  requestId?: string;
  executionId?: string;
  status?: AthenaKernelState;
  toolId?: string;
  model?: string;
  provider?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface AthenaMetricsWindow {
  from: string;
  to: string;
}

export interface AthenaOverviewMetrics {
  window: AthenaMetricsWindow;
  requestCount: number;
  successRate: number;
  errorRate: number;
  degradedRate: number;
  deniedRate: number;
  latencyMsP50: number | null;
  latencyMsP95: number | null;
  latencyMsP99: number | null;
  totalCostUsd: number;
  averageTraceCompleteness: number | null;
}

export interface AthenaToolMetric {
  toolId: string;
  invocationCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  latencyMsP50: number | null;
  latencyMsP95: number | null;
}

export interface AthenaModelMetric {
  provider: string;
  model: string;
  invocationCount: number;
  failureCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  latencyMsP50: number | null;
  latencyMsP95: number | null;
}

export interface AthenaCostSummary {
  window: AthenaMetricsWindow;
  totalEstimatedUsd: number;
  costPerRequestUsd: number | null;
  costPerSuccessfulRequestUsd: number | null;
  byProvider: { provider: string; estimatedUsd: number }[];
  byModel: { provider: string; model: string; estimatedUsd: number }[];
}

export interface AthenaEventHealthSummary {
  window: AthenaMetricsWindow;
  eventCount: number;
  deliveryCount: number;
  deliverySuccessRate: number;
  pendingRetryCount: number;
  deadLetterCount: number;
  deadLetterCountByType: { type: string; count: number }[];
}

export const athenaAlertSeverities = ["critical", "high", "medium", "low"] as const;
export type AthenaAlertSeverity = (typeof athenaAlertSeverities)[number];

export const athenaAlertStatuses = ["active", "resolved"] as const;
export type AthenaAlertStatus = (typeof athenaAlertStatuses)[number];

export interface AthenaAlertRecord {
  id: string;
  orgId: string;
  ruleId: string;
  dedupeKey: string;
  severity: AthenaAlertSeverity;
  status: AthenaAlertStatus;
  summary: string;
  metadata: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

export interface AthenaMetricsWindowParams {
  from?: string;
  to?: string;
}

function buildAthenaWindowQuery(window: AthenaMetricsWindowParams): string {
  const params = new URLSearchParams();
  if (window.from) params.set("from", window.from);
  if (window.to) params.set("to", window.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function getAthenaObservabilityOverview(token: string, window: AthenaMetricsWindowParams = {}) {
  return apiFetch<AthenaOverviewMetrics>(`/api/v1/athena/observability/overview${buildAthenaWindowQuery(window)}`, { token });
}

export function searchAthenaTraces(token: string, params: AthenaTraceSearchParams = {}) {
  const query = new URLSearchParams();
  if (params.traceId) query.set("traceId", params.traceId);
  if (params.requestId) query.set("requestId", params.requestId);
  if (params.executionId) query.set("executionId", params.executionId);
  if (params.status) query.set("status", params.status);
  if (params.toolId) query.set("toolId", params.toolId);
  if (params.model) query.set("model", params.model);
  if (params.provider) query.set("provider", params.provider);
  if (params.actorUserId) query.set("actorUserId", params.actorUserId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  return apiFetch<AthenaTraceSearchResult>(`/api/v1/athena/observability/traces${qs ? `?${qs}` : ""}`, { token });
}

export function getAthenaTraceByTrace(token: string, traceId: string) {
  return apiFetch<AthenaTraceDetail>(`/api/v1/athena/observability/traces/by-trace/${traceId}`, { token });
}

export function getAthenaTraceByRequest(token: string, requestId: string) {
  return apiFetch<AthenaTraceDetail>(`/api/v1/athena/observability/traces/by-request/${requestId}`, { token });
}

export function getAthenaToolMetrics(token: string, window: AthenaMetricsWindowParams = {}) {
  return apiFetch<AthenaToolMetric[]>(`/api/v1/athena/observability/tools${buildAthenaWindowQuery(window)}`, { token });
}

export function getAthenaModelMetrics(token: string, window: AthenaMetricsWindowParams = {}) {
  return apiFetch<AthenaModelMetric[]>(`/api/v1/athena/observability/models${buildAthenaWindowQuery(window)}`, { token });
}

export function getAthenaCostSummary(token: string, window: AthenaMetricsWindowParams = {}) {
  return apiFetch<AthenaCostSummary>(`/api/v1/athena/observability/cost${buildAthenaWindowQuery(window)}`, { token });
}

export function getAthenaEventHealth(token: string, window: AthenaMetricsWindowParams = {}) {
  return apiFetch<AthenaEventHealthSummary>(`/api/v1/athena/observability/events${buildAthenaWindowQuery(window)}`, { token });
}

export function listAthenaAlerts(token: string, params: { status?: AthenaAlertStatus } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return apiFetch<AthenaAlertRecord[]>(`/api/v1/athena/observability/alerts${qs ? `?${qs}` : ""}`, { token });
}

export interface AthenaApprovalRecord {
  approvalId: string;
  userId: string;
  organizationId: string;
  actionId: string;
  toolId: string;
  toolVersion: string;
  riskLevel: "low" | "medium" | "high";
  approvedAt: string;
  approvedBy: string;
  expiration: string;
  status: "pending" | "granted" | "denied" | "revoked" | "expired";
  idempotencyKey: string;
  inputHash: string;
  planId: string;
  stepId: string;
  metadata: Record<string, unknown>;
}

export interface AthenaApprovalAuditRecord {
  id: string;
  timestamp: string;
  eventType: "request_received" | "context_gathered" | "tools_considered" | "action_attempted" | "approval_requested" | "execution_completed" | "failure";
  actorUserId: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown>;
}

export interface AthenaApprovalDetail {
  approval: AthenaApprovalRecord;
  auditEvents: AthenaApprovalAuditRecord[];
}

export interface AthenaApprovalSubmissionInput {
  actionId: string;
  toolId: string;
  toolVersion: string;
  riskLevel: "medium" | "high";
  expiration: string;
  idempotencyKey: string;
  inputHash: string;
  planId: string;
  stepId: string;
  metadata?: Record<string, unknown>;
}

export function listAthenaApprovals(token: string, params: { status?: AthenaApprovalRecord["status"]; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.limit != null) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch<AthenaApprovalRecord[]>(`/api/v1/athena/approvals${qs ? `?${qs}` : ""}`, { token });
}

export function getAthenaApproval(token: string, approvalId: string) {
  return apiFetch<AthenaApprovalDetail>(`/api/v1/athena/approvals/${approvalId}`, { token });
}

export function submitAthenaApproval(token: string, input: AthenaApprovalSubmissionInput) {
  return apiFetch<AthenaApprovalRecord>("/api/v1/athena/approvals", {
    token,
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function reviewAthenaApproval(token: string, approvalId: string, decision: "grant" | "deny") {
  return apiFetch<AthenaApprovalRecord>(`/api/v1/athena/approvals/${approvalId}/review`, {
    token,
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}
