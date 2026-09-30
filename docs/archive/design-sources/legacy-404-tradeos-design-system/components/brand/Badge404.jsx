import React from "react";

/**
 * The 404 · TRADE · OS logo badge — a monospace pill that always accompanies
 * the wordmark. "404" is part of the brand name and must never be dropped.
 */
export function Badge404({ className = "", style }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: "1px solid var(--color-forge-border)",
        borderRadius: 4,
        padding: "2px 8px",
        background: "var(--color-forge-dark)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.12em",
        ...style,
      }}
    >
      <span style={{ color: "var(--color-copper-light)" }}>404</span>
      <span style={{ display: "inline-block", width: 1, height: 12, background: "var(--color-forge-border)" }} />
      <span style={{ color: "var(--color-copper)" }}>TRADE</span>
      <span style={{ display: "inline-block", width: 1, height: 12, background: "var(--color-forge-border)" }} />
      <span style={{ color: "var(--color-copper-light)" }}>OS</span>
    </span>
  );
}
