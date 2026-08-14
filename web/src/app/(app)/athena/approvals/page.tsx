import type { Metadata } from "next";
import { AthenaApprovalsWorkspace } from "@/components/athena/athena-approvals-workspace";
import { AthenaSectionTabs } from "@/components/athena/athena-section-tabs";
import { AthenaStatePanel } from "@/components/athena/athena-state-panel";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getAthenaOperatorContext } from "@/lib/athena-access";
import { describeAthenaLoadError, type AthenaLoadOutcome } from "@/lib/athena-state";
import { getAthenaApproval, listAthenaApprovals, type AthenaApprovalDetail, type AthenaApprovalRecord } from "@/lib/api";

export const metadata: Metadata = {
  title: "Athena Approvals | TradeOS",
  description: "Operator review queue for medium- and high-risk Athena actions.",
};

interface AthenaApprovalsSearchParams {
  approvalId?: string;
}

export default async function AthenaApprovalsPage({ searchParams }: { searchParams: Promise<AthenaApprovalsSearchParams> }) {
  const [access, query] = await Promise.all([getAthenaOperatorContext(), searchParams]);

  if (!access.granted) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Athena Approvals" description="Operator review queue for medium- and high-risk Athena actions." />
        <EmptyState title="Athena access required" description="Only owner and admin roles can review Athena approvals." />
      </div>
    );
  }

  let approvals: AthenaApprovalRecord[] = [];
  let selectedApproval: AthenaApprovalDetail | null = null;
  let loadState: AthenaLoadOutcome | null = null;

  try {
    approvals = await listAthenaApprovals(access.token, { limit: 50 });
    const approvalId = query.approvalId ?? approvals[0]?.approvalId;
    if (approvalId) selectedApproval = await getAthenaApproval(access.token, approvalId);
  } catch (error) {
    loadState = describeAthenaLoadError(error);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Athena Approvals" description="Submit, review, and audit medium- and high-risk Athena action approvals." />
      <AthenaSectionTabs active="approvals" />
      {loadState ? <AthenaStatePanel state={loadState} /> : <AthenaApprovalsWorkspace approvals={approvals} selectedApproval={selectedApproval} />}
    </div>
  );
}
