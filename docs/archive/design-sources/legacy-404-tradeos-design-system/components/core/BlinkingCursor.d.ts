export interface BlinkingCursorProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A copper terminal cursor that blinks on a steps(1) cadence. Append after
 * typed/terminal text. Blink stops under prefers-reduced-motion.
 */
export function BlinkingCursor(props: BlinkingCursorProps): JSX.Element;
