export default function CustomerPortalAccessErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-4 px-6 py-12">
      <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Customer portal</p>
      <h1 className="text-3xl font-semibold tracking-tight">This link is no longer available</h1>
      <p className="text-muted-foreground">The link may have expired, already been used, or been revoked. Ask your contractor for a new invitation.</p>
    </main>
  );
}
