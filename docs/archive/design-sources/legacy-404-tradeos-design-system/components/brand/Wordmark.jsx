import React from "react";

/**
 * The TradeOS wordmark — Space Grotesk logotype with a copper "OS" suffix.
 * @param {"sm"|"md"|"lg"|"xl"} size
 * @param {"dark"|"light"} tone  dark = bone text (on dark bg), light = forge-black text
 */
export function Wordmark({ size = "md", tone = "dark", className = "", style }) {
  const sizes = { sm: 18, md: 24, lg: 32, xl: 46 };
  const base = tone === "light" ? "var(--color-forge-black)" : "var(--color-bone)";
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 500,
        fontSize: sizes[size] || sizes.md,
        letterSpacing: "-0.03em",
        lineHeight: 1,
        color: base,
        ...style,
      }}
    >
      Trade<span style={{ color: "var(--color-copper)" }}>OS</span>
    </span>
  );
}
