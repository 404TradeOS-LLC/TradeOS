import { ChevronRight } from "lucide-react";
import "./attention-item.css";

export type AttentionItemSeverity = "info" | "action" | "urgent";

export interface AttentionItemProps {
  title: string;
  description: string;
  meta?: string;
  severity: AttentionItemSeverity;
  status: string;
  action: string;
  onAction: () => void;
}

/** A production Needs You row that keeps severity readable without relying on color alone. */
export function AttentionItem({ title, description, meta, severity, status, action, onAction }: AttentionItemProps) {
  return <li className="today-attention-row" data-severity={severity}>
    <span className="today-attention-severity-bar" aria-hidden="true" />
    <div className="today-attention-content">
      <h3>{title}</h3>
      <p>{description}</p>
      {meta ? <span className="today-attention-meta">{meta}</span> : null}
    </div>
    <div className="today-attention-actions">
      <span className="today-attention-status" data-severity={severity}>{status}</span>
      <button type="button" className="today-row-action" onClick={onAction} aria-label={`${action}: ${title}`}>
        {action}<ChevronRight size={14} aria-hidden="true" />
      </button>
    </div>
  </li>;
}
