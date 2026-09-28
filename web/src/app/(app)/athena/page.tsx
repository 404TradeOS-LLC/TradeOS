import type { Metadata } from "next";
import { AthenaWorkspace } from "@/components/athena/athena-workspace";
import { getAthenaOperatorContext } from "@/lib/athena-access";
import type { AthenaSelectedScope } from "@/lib/athena-client";

export const metadata: Metadata = {
  title: "Athena | TradeOS",
  description: "TradeOS intelligence workspace for understanding, drafting, and acting on real contractor work through authenticated domain tools.",
};

interface AthenaWorkspaceSearchParams {
  customerId?: string;
  projectId?: string;
  jobId?: string;
  estimateId?: string;
  invoiceId?: string;
  page?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(value?: string) {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

function buildSelectedScope(query: AthenaWorkspaceSearchParams): AthenaSelectedScope | undefined {
  const selectedScope: AthenaSelectedScope = {
    customerId: validUuid(query.customerId),
    projectId: validUuid(query.projectId),
    jobId: validUuid(query.jobId),
    estimateId: validUuid(query.estimateId),
    invoiceId: validUuid(query.invoiceId),
    page: query.page?.trim().slice(0, 200) || undefined,
  };

  return Object.values(selectedScope).some(Boolean) ? selectedScope : undefined;
}

export default async function AthenaPage({ searchParams }: { searchParams: Promise<AthenaWorkspaceSearchParams> }) {
  const query = await searchParams;
  const selectedScope = buildSelectedScope(query);

  // Operator-link discovery must never gate the contractor workspace itself.
  // A denied/error result simply omits the observability shortcut.
  const operatorAccess = await getAthenaOperatorContext();

  return <AthenaWorkspace selectedScope={selectedScope} operatorHref={operatorAccess.granted ? "/athena/ops" : undefined} />;
}
