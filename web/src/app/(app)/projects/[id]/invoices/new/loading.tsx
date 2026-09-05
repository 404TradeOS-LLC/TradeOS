import { DocumentDetailSkeleton } from "@/components/shared/document-detail-skeleton";

export default function NewInvoiceLoading() {
  return <DocumentDetailSkeleton label="Loading new invoice form" columns="1.1fr_0.9fr" />;
}
