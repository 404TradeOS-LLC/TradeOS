export default function NewProjectLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading new project form">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="rounded-lg border border-border/70 bg-card p-4">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-9 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
        <div className="mt-4 h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
