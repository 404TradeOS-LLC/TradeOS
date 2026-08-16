import type { Metadata } from "next";
import { PricingPreviewCalculator } from "@/components/costbook/pricing-preview-calculator";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Pricing Preview | Costbook | TradeOS" };

export default function CostbookPricingPage() {
  return <div className="flex flex-col gap-6">
    <PageHeader title="Pricing Preview" description="Use the same markup, target-margin, and overhead formulas as the Estimate Engine without persisting a pricing rule." backHref="/costbook" backLabel="Costbook" />
    <PricingPreviewCalculator />
  </div>;
}
