import React from "react";

const COLORS = {
  online: "var(--color-system-green)",
  processing: "var(--color-copper)",
  error: "var(--color-error-red)",
  idle: "var(--color-forge-rust)",
};

/**
 * Pulsing status dot + monospace label. `online` is the only state that uses green.
 * @param {"online"|"processing"|"error"|"idle"} status
 */
export function StatusLED({ status = "online", label, className = "", style }) {
  const color = COLORS[status] || COLORS.online;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color,
        ...style,
      }}
    >
      <span
        className={status !== "idle" ? "led-pulse" : ""}
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          flexShrink: 0,
          background: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      {label}
    </span>
  );
}
