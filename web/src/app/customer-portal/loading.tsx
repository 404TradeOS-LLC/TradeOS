import { CustomerPortalSkeleton } from "@/components/shared/customer-portal-skeleton";

export default function CustomerPortalHomeLoading() {
  return <CustomerPortalSkeleton label="Loading your projects" cards={2} />;
}
