export interface StatusPillProps {
  /** online = green success · copper = accent chip · neutral = rust outline */
  tone?: "online" | "neutral" | "copper";
  /** show the leading dot */
  dot?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Rounded monospace pill for statuses and small tags. Green `online` tone is
 * reserved for success/online; use `copper` or `neutral` otherwise.
 */
export function StatusPill(props: StatusPillProps): JSX.Element;
