import { FileText } from "lucide-react";
import { sendInvoiceAction } from "@/app/actions/invoices";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * DES-7 (a): the draft detail page's Send + Open PDF actions sit below the
 * Billing card, line items, and activity on mobile, so on a 390px screen a
 * contractor has to scroll past the whole invoice to send it or open the
 * PDF. This row puts both actions near the top on mobile only (`xl:hidden`);
 * at desktop widths the aside's Next action / Document cards remain the
 * single home for them, and the aside copies are hidden below `xl` so the
 * actions are never rendered twice on the same screen.
 */
export function InvoiceTopActions({ isDraft, projectId, invoiceId }: { isDraft: boolean; projectId: string; invoiceId: string }) {
  return (
    <section aria-label="Invoice actions" className="grid gap-2 sm:grid-cols-2 xl:hidden">
      {isDraft ? (
        <form action={sendInvoiceAction}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="projectId" value={projectId} />
          <Button type="submit" className="h-11 w-full">
            Send invoice
          </Button>
        </form>
      ) : null}
      <a
        href={`/api/documents/invoices/${invoiceId}/pdf`}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: "outline", className: "flex h-11 w-full items-center justify-center" })}
      >
        <FileText className="size-4" aria-hidden="true" />
        Open PDF
      </a>
    </section>
  );
}
