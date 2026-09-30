export interface CornerBracketsProps {
  /** arm length in px */
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Decorative CNC-reticle corner ticks. Drop inside any position:relative
 * container (often revealed on hover) for the industrial-instrument look.
 */
export function CornerBrackets(props: CornerBracketsProps): JSX.Element;
