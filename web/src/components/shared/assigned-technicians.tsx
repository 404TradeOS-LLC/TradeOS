function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

interface AssignedTechniciansProps {
  technicians: { name: string }[];
  className?: string;
}

/**
 * Compact initials-avatar + name for a job's assigned technicians, replacing
 * a plain comma-joined name string with a visual identity per person.
 */
export function AssignedTechnicians({ technicians, className }: AssignedTechniciansProps) {
  if (technicians.length === 0) {
    return <span className="text-muted-foreground">Unassigned</span>;
  }

  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className ?? ""}`}>
      {technicians.map((tech, index) => (
        <li key={`${tech.name}-${index}`} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground ring-1 ring-border"
          >
            {initialsFor(tech.name)}
          </span>
          <span className="truncate">{tech.name}</span>
        </li>
      ))}
    </ul>
  );
}
