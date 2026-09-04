export default function OverdueTasksLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading overdue tasks">
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
