import React from "react";

export interface OSModuleCardProps {
  /** icon node, e.g. a Lucide icon */
  icon?: React.ReactNode;
  /** module id, e.g. "MOD-01" */
  id: string;
  title: string;
  body: string;
  /** optional price row ("$197/mo") */
  from?: string;
  /** optional timeline row ("2–3 weeks") */
  time?: string;
  version?: string;
  as?: "a" | "div";
  href?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A service/feature presented as an installed "OS module" — copper icon tile,
 * MOD-0X id, RUNNING status footer, and hover corner-brackets. The primary
 * services-grid card on the marketing site.
 *
 * @startingPoint section="Chrome" subtitle="Service-as-OS-module card" viewport="360x220"
 */
export function OSModuleCard(props: OSModuleCardProps): JSX.Element;
