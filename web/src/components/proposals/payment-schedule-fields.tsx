import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProposalPaymentScheduleEntry } from "@/lib/api";

interface PaymentScheduleFieldsProps {
  schedule: ProposalPaymentScheduleEntry[];
}

export function PaymentScheduleFields({ schedule }: PaymentScheduleFieldsProps) {
  const rows = Array.from({ length: 3 }, (_, index) => schedule[index] ?? { label: "", amountPercent: 0, notes: "" });

  return (
    <div className="grid gap-4">
      <div>
        <Label>Payment schedule</Label>
        <p className="mt-1 text-sm text-muted-foreground">Define the customer-facing draw schedule before creating or sending the proposal.</p>
      </div>
      {rows.map((entry, index) => (
        <div key={`payment-row-${index}`} className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 md:grid-cols-[1fr_120px]">
          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`paymentLabel${index}`}>Milestone {index + 1}</Label>
              <Input id={`paymentLabel${index}`} name={`paymentLabel${index}`} defaultValue={entry.label} placeholder="Deposit" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`paymentNotes${index}`}>Notes</Label>
              <Input
                id={`paymentNotes${index}`}
                name={`paymentNotes${index}`}
                defaultValue={entry.notes ?? ""}
                placeholder="Due at scheduling to secure labor and materials."
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`paymentPercent${index}`}>Percent</Label>
            <Input
              id={`paymentPercent${index}`}
              name={`paymentPercent${index}`}
              defaultValue={entry.amountPercent ? String(entry.amountPercent) : ""}
              inputMode="decimal"
              placeholder="30"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
