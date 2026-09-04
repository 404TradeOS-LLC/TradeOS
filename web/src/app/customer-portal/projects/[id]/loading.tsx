import { CustomerPortalSkeleton } from "@/components/shared/customer-portal-skeleton";

export default function CustomerPortalProjectLoading() {
  return <CustomerPortalSkeleton label="Loading project" cards={3} />;
}
