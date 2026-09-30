import React from "react";

/**
 * Forge-dark surface card. `variant="panel"` is slightly larger radius + padding.
 * Industrial UI favors a 1px border over drop shadows.
 */
export function Card({ variant = "card", children, className = "", style, ...rest }) {
  const isPanel = variant === "panel";
  return (
    <div
      className={className}
      style={{
        background: "var(--color-forge-dark)",
        border: "1px solid var(--color-forge-border)",
        borderRadius: isPanel ? 14 : 12,
        padding: isPanel ? 28 : 24,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
