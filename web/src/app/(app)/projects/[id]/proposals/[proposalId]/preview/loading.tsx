export default function ProposalPreviewLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading proposal PDF preview">
      <div className="space-y-2">
        <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-[80vh] max-h-[960px] animate-pulse rounded-lg border border-border/70 bg-muted/30" />
    </div>
  );
}
