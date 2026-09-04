import { CustomerPortalSkeleton } from "@/components/shared/customer-portal-skeleton";

export default function CustomerPortalContractLoading() {
  return <CustomerPortalSkeleton label="Loading contract" cards={2} />;
}
