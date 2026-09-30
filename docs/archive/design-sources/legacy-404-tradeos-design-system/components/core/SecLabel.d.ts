import React from "react";

export interface SecLabelProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Copper monospace eyebrow label. Convention: place one before every h2.
 */
export function SecLabel(props: SecLabelProps): JSX.Element;
