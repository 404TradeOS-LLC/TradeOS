export default function ProjectIntakeLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading field intake">
      <div className="space-y-2">
        <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="h-[32rem] animate-pulse rounded-lg border border-border/70 bg-muted/30" />
        <div className="flex flex-col gap-4">
          <div className="h-40 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
          <div className="h-56 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
        </div>
      </div>
    </div>
  );
}
