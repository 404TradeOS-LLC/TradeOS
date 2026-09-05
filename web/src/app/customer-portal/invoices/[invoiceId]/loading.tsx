import { CustomerPortalSkeleton } from "@/components/shared/customer-portal-skeleton";

export default function CustomerPortalInvoiceLoading() {
  return <CustomerPortalSkeleton label="Loading invoice" cards={2} />;
}
