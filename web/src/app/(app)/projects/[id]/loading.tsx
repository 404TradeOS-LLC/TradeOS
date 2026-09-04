import { DocumentDetailSkeleton } from "@/components/shared/document-detail-skeleton";

export default function ProjectDetailLoading() {
  return <DocumentDetailSkeleton label="Loading project" columns="1.2fr_0.8fr" withTabs />;
}
