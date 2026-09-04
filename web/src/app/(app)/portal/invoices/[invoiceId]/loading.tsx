import { DocumentDetailSkeleton } from "@/components/shared/document-detail-skeleton";

export default function PortalInvoicePreviewLoading() {
  return <DocumentDetailSkeleton label="Loading customer portal invoice preview" columns="1.05fr 0.95fr" />;
}
