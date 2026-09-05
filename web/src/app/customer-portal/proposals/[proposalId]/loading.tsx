import { CustomerPortalSkeleton } from "@/components/shared/customer-portal-skeleton";

export default function CustomerPortalProposalLoading() {
  return <CustomerPortalSkeleton label="Loading proposal" cards={2} />;
}
