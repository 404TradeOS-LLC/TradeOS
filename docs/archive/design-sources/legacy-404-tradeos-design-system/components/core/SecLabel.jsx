import React from "react";

/**
 * Section eyebrow — a copper monospace label that precedes every h2.
 */
export function SecLabel({ children, className = "", style }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--color-copper)",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        display: "block",
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
