import React from "react";

/**
 * Blinking terminal cursor block. Respects prefers-reduced-motion (via .blink-cursor).
 */
export function BlinkingCursor({ className = "", style }) {
  return (
    <span
      className={`blink-cursor ${className}`}
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: "0.6em",
        height: "1.05em",
        marginLeft: 2,
        transform: "translateY(2px)",
        background: "var(--color-copper)",
        ...style,
      }}
    />
  );
}
