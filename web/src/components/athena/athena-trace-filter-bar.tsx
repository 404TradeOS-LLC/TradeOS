import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { athenaKernelStates } from "@/lib/api";
import { athenaIsoToDatetimeLocal, type AthenaTraceFilterInput } from "@/lib/athena-trace-query";
import { cn } from "@/lib/utils";

/**
 * Plain GET form filter bar - same "form method=get, full resubmit"
 * precedent DispatchFilterBar already established in this codebase, rather
 * than introducing client-side filter state. `from`/`to` use
 * datetime-local inputs interpreted as UTC (see
 * lib/athena-trace-query.ts's athenaDatetimeLocalToIso doc comment).
 */
export function AthenaTraceFilterBar({ filters }: { filters: AthenaTraceFilterInput }) {
  return (
    <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <Field label="Trace ID" name="traceId" defaultValue={filters.traceId} placeholder="uuid" />
      <Field label="Request ID" name="requestId" defaultValue={filters.requestId} placeholder="uuid" />
      <Field label="Execution ID" name="executionId" defaultValue={filters.executionId} placeholder="uuid" />

      <SelectField label="Status" name="status" defaultValue={filters.status ?? ""}>
        <option value="">All statuses</option>
        {athenaKernelStates.map((state) => (
          <option key={state} value={state}>
            {state.replaceAll("_", " ")}
          </option>
        ))}
      </SelectField>

      <Field label="Tool" name="toolId" defaultValue={filters.toolId} placeholder="tool id" />
      <Field label="Model" name="model" defaultValue={filters.model} placeholder="gpt-5.1" />
      <Field label="Provider" name="provider" defaultValue={filters.provider} placeholder="openai" />
      <Field label="Actor user ID" name="actorUserId" defaultValue={filters.actorUserId} placeholder="uuid" />

      <div className="flex flex-col gap-2">
        <label htmlFor="athena-traces-from" className="text-sm font-medium text-foreground">
          From (UTC)
        </label>
        <Input id="athena-traces-from" name="from" type="datetime-local" defaultValue={athenaIsoToDatetimeLocal(filters.from)} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="athena-traces-to" className="text-sm font-medium text-foreground">
          To (UTC)
        </label>
        <Input id="athena-traces-to" name="to" type="datetime-local" defaultValue={athenaIsoToDatetimeLocal(filters.to)} />
      </div>

      <button type="submit" className={cn(buttonVariants(), "sm:col-span-2 lg:col-span-4")}>
        Apply filters
      </button>
    </form>
  );
}

function Field({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue?: string; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`athena-traces-${name}`} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input id={`athena-traces-${name}`} name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
    </div>
  );
}
