import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** card = 12px radius / 24px pad · panel = 14px radius / 28px pad */
  variant?: "card" | "panel";
  children?: React.ReactNode;
}

/**
 * Forge-dark surface with a 1px copper-rust border and small radius. The base
 * container for grouped content; prefer borders over shadows.
 *
 * @startingPoint section="Core" subtitle="Forge-dark bordered surface" viewport="360x160"
 */
export function Card(props: CardProps): JSX.Element;
