export interface WordmarkProps {
  /** 18 / 24 / 32 / 46px */
  size?: "sm" | "md" | "lg" | "xl";
  /** dark = bone text for dark backgrounds; light = forge-black text for light backgrounds */
  tone?: "dark" | "light";
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The TradeOS logotype (Space Grotesk, copper "OS"). Pair with <Badge404/> in
 * the full lockup; the "OS" is always copper (#B87333) — never recolor it.
 *
 * @startingPoint section="Brand" subtitle="TradeOS wordmark logotype" viewport="200x60"
 */
export function Wordmark(props: WordmarkProps): JSX.Element;
