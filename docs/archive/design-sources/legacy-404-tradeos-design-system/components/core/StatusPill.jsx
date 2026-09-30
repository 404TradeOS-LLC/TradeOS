import React from "react";

/**
 * Rounded status pill. `tone="online"` is the green success pill; `mono` is a
 * neutral rust label chip. Green is reserved for online/success only.
 * @param {"online"|"neutral"|"copper"} tone
 */
export function StatusPill({ tone = "online", dot = true, children, className = "", style }) {
  const tones = {
    online: {
      color: "var(--color-system-green)",
      background: "rgba(0,200,150,0.1)",
      border: "1px solid rgba(0,200,150,0.3)",
    },
    copper: {
      color: "var(--color-copper-light)",
      background: "rgba(184,115,51,0.12)",
      border: "1px solid rgba(184,115,51,0.35)",
    },
    neutral: {
      color: "var(--color-forge-rust)",
      background: "transparent",
      border: "1px solid var(--color-forge-border)",
    },
  };
  const t = tones[tone] || tones.online;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        letterSpacing: "0.04em",
        borderRadius: 999,
        padding: "3px 10px",
        ...t,
        ...style,
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
      )}
      {children}
    </span>
  );
}
