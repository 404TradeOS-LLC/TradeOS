import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { jobStatuses } from "@/domain";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS = [
  { value: "attention", label: "Needs attention" },
  { value: "invoice-ready", label: "Ready-to-invoice handoff" },
  { value: "all", label: "All jobs" },
];

const SCHEDULED_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

const ASSIGNED_OPTIONS = [
  { value: "all", label: "All jobs" },
  { value: "assigned", label: "Assigned" },
  { value: "unassigned", label: "Unassigned" },
];

// Same "capitalize + replace underscores" rendering StatusBadge already
// uses for any job status it doesn't have an explicit label override for -
// kept identical here rather than inventing a second label source.
function formatStatusOptionLabel(status: string) {
  return status.replaceAll("_", " ");
}

interface DispatchFilterBarProps {
  view: "attention" | "all" | "invoice-ready";
  status?: string;
  scheduled?: string;
  assigned?: string;
  q?: string;
}

/**
 * Plain GET form filter bar - no client state, matches the estimate-compare
 * page's "form method=get, full resubmit" precedent already established in
 * this codebase rather than introducing client-side filter state.
 *
 * "View" is the first field so switching from the "Needs attention" default
 * to "All jobs" (and back) is always one visible, reachable control - never
 * only escapable via clearing every other filter.
 */
export function DispatchFilterBar({ view, status, scheduled, assigned, q }: DispatchFilterBarProps) {
  return (
    <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <SelectField label="View" name="view" defaultValue={view}>
        {VIEW_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      <SelectField label="Status" name="status" defaultValue={status ?? ""}>
        <option value="">All statuses</option>
        {jobStatuses.map((jobStatus) => (
          <option key={jobStatus} value={jobStatus} className="capitalize">
            {formatStatusOptionLabel(jobStatus)}
          </option>
        ))}
      </SelectField>

      <SelectField label="Schedule" name="scheduled" defaultValue={scheduled ?? "all"}>
        {SCHEDULED_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      <SelectField label="Assignment" name="assigned" defaultValue={assigned ?? "all"}>
        {ASSIGNED_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
        <label htmlFor="dispatch-search" className="text-sm font-medium text-foreground">
          Search
        </label>
        <Input id="dispatch-search" name="q" type="search" defaultValue={q ?? ""} placeholder="Job #, title, address…" />
      </div>

      <button type="submit" className={cn(buttonVariants(), "sm:col-span-2 lg:col-span-5")}>
        Apply filters
      </button>
    </form>
  );
}
