import { DocumentDetailSkeleton } from "@/components/shared/document-detail-skeleton";

export default function InvoiceDetailLoading() {
  return <DocumentDetailSkeleton label="Loading invoice" columns="1.05fr_0.95fr" />;
}
