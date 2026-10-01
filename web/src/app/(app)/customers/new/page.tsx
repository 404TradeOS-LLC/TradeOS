"use client";

import { CustomerCreateForm } from "./customer-create-form";
import { PageHeader } from "@/components/shared/page-header";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Add customer"
        description="Enter the contact details you want on bids, proposals, invoices, and payment reminders."
        backHref="/customers"
        backLabel="Back to customers"
      />
      <CustomerCreateForm />
    </div>
  );
}
