export default function OverdueTasksLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-6" aria-label="Loading overdue tasks">
      <span className="sr-only">Loading overdue tasks</span>
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-lg border border-border/60 bg-muted/30" />
        ))}
      </div>
    </div>
  );
}
