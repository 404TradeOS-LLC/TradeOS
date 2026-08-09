import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function SelectField({ label, hint, error, className, id, children, ...props }: SelectFieldProps) {
  const selectId = id ?? props.name;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={selectId}>{label}</Label>
      <select
        id={selectId}
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
          error ? "border-destructive" : "",
          className
        )}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={hint || error ? `${selectId}-description` : undefined}
        {...props}
      >
        {children}
      </select>
      {(hint || error) && (
        <p id={`${selectId}-description`} className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

