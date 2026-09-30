export interface StatusLEDProps {
  /** online (green) · processing (copper) · error (red) · idle (rust, no pulse) */
  status?: "online" | "processing" | "error" | "idle";
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Pulsing diagnostic status dot + mono label. `online` is the ONLY state
 * permitted to use green; all others use copper/red/rust.
 *
 * @startingPoint section="Core" subtitle="Diagnostic status indicator" viewport="320x40"
 */
export function StatusLED(props: StatusLEDProps): JSX.Element;
