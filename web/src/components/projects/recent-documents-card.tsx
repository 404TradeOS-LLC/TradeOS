import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRowLink } from "@/components/shared/list-row-link";
import { StatusBadge } from "@/components/shared/status-badge";

interface RecentDocumentsCardProps {
  documents: Array<{ id: string; href: string; label: string; status?: string }>;
}

export function RecentDocumentsCard({ documents }: RecentDocumentsCardProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Quotes and documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {documents.length === 0 ? (
          <EmptyState title="No documents yet." description="Proposals, invoices, and contracts will appear here once you create them." />
        ) : (
          documents.map((document) => (
            <ListRowLink
              key={document.id}
              href={document.href}
              title={document.label}
              trailing={document.status ? <StatusBadge status={document.status} /> : undefined}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
