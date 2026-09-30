import React from "react";

export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  /** primary = copper fill · outline = copper border · ghost = subtle border */
  variant?: "primary" | "outline" | "ghost";
  /** Render as a different element, e.g. "a" for links */
  as?: "button" | "a";
  href?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Brand button — copper primary, copper-outline, and subtle ghost variants.
 * Presses with a scale(0.96) + brightness pulse. Copper is the only fill color.
 *
 * @startingPoint section="Core" subtitle="Primary / outline / ghost buttons" viewport="360x60"
 */
export function Button(props: ButtonProps): JSX.Element;
