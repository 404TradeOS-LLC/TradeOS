import type { Metadata } from "next";
import { AthenaWorkspace } from "@/components/athena/athena-workspace";
import type { AthenaSelectedScope } from "@/lib/athena-client";

export const metadata: Metadata = {
  title: "Athena | TradeOS",
  description: "TradeOS intelligence workspace for understanding, drafting, and acting on real contractor work through authenticated domain tools.",
};

type SearchParamValue = string | string[] | undefined;

interface AthenaWorkspaceSearchParams {
  customerId?: SearchParamValue;
  projectId?: SearchParamValue;
  jobId?: SearchParamValue;
  estimateId?: SearchParamValue;
  invoiceId?: SearchParamValue;
  page?: SearchParamValue;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstQueryValue(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validUuid(value: SearchParamValue) {
  const normalized = firstQueryValue(value);
  return normalized && UUID_PATTERN.test(normalized) ? normalized : undefined;
}

function buildSelectedScope(query: AthenaWorkspaceSearchParams): AthenaSelectedScope | undefined {
  const page = firstQueryValue(query.page)?.trim().slice(0, 200) || undefined;
  const selectedScope: AthenaSelectedScope = {
    customerId: validUuid(query.customerId),
    projectId: validUuid(query.projectId),
    jobId: validUuid(query.jobId),
    estimateId: validUuid(query.estimateId),
    invoiceId: validUuid(query.invoiceId),
    page,
  };

  return Object.values(selectedScope).some(Boolean) ? selectedScope : undefined;
}

export default async function AthenaPage({ searchParams }: { searchParams: Promise<AthenaWorkspaceSearchParams> }) {
  const query = await searchParams;
  return <AthenaWorkspace selectedScope={buildSelectedScope(query)} />;
}
