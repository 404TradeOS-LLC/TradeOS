import "server-only";
import type { OrganizationSettingsResponse } from "@/lib/settings";
import type { BrandAsset, BrandDocumentSettings, BrandProfile, BrandStudioPreview } from "@/lib/brand-studio";
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
}

export type EstimateDetail = Estimate & { lineItems: EstimateLineItem[] };

export function listEstimatesByProject(token: string, projectId: string) {
  return apiFetch<Estimate[]>(`/api/v1/estimates/by-project/${projectId}`, { token }).then((estimates) =>
    estimates.map((estimate) => ({ ...estimate, status: normalizeStatus(estimate.status, legacyEstimateStatusMap, estimateStatuses, "draft") }))
  );
}

export function getEstimate(token: string, id: string) {
  return apiFetch<EstimateDetail>(`/api/v1/estimates/${id}`, { token }).then((estimate) => ({
    ...estimate,
    status: normalizeStatus(estimate.status, legacyEstimateStatusMap, estimateStatuses, "draft"),
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

export function listProjectTasks(token: string, projectId: string) {
  return apiFetch<ProjectTask[]>(`/api/v1/projects/${projectId}/tasks`, { token });
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

export function getProjectProposalDraft(token: string, projectId: string) {
  return apiFetch<ProposalDraftPreview>(`/api/v1/proposals/project-draft/${projectId}`, { token });
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
  deliveries: InvoiceDelivery[];
}

export function getInvoice(token: string, id: string) {
  return apiFetch<Invoice & { lineItems: InvoiceLineItem[] }>(`/api/v1/invoices/${id}`, { token }).then((invoice) => ({
    ...invoice,
    status: normalizeStatus(invoice.status, legacyInvoiceStatusMap, invoiceStatuses, "draft"),
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
