import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Customer } from "@/lib/api";

interface CustomerHeaderCardProps {
  customer: Customer | null;
}

export function CustomerHeaderCard({ customer }: CustomerHeaderCardProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Customer contact</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <div className="font-medium text-foreground">{customer?.name ?? "Unassigned"}</div>
        <div className="mt-1">{customer?.email ?? "No email saved yet"}</div>
        <div className="mt-1">{customer?.phone ?? "No phone saved yet"}</div>
      </CardContent>
    </Card>
  );
}
