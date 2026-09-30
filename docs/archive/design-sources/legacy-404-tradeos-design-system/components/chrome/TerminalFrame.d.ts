import React from "react";

export interface TerminalFrameProps {
  /** mono title shown in the chrome bar */
  title: string;
  status?: "online" | "processing" | "error" | "idle";
  statusLabel?: string;
  /** replaces the default StatusLED in the header (e.g. view toggles) */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The diagnostic window-chrome shell: two dim square "lights" + one copper,
 * a monospace title, and a StatusLED. Wrap dashboards, demos, and code panels.
 *
 * @startingPoint section="Chrome" subtitle="Terminal window shell" viewport="560x260"
 */
export function TerminalFrame(props: TerminalFrameProps): JSX.Element;
