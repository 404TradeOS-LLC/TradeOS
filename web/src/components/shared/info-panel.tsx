import type { ReactNode } from "react";

interface InfoPanelProps {
  title: string;
  children: ReactNode;
}

export function InfoPanel({ title, children }: InfoPanelProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
