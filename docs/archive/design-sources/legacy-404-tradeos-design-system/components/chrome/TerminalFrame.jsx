import React from "react";
import { StatusLED } from "../core/StatusLED.jsx";

/**
 * Window-chrome shell: two dim square lights + a copper light, a mono title,
 * and a StatusLED. The core "diagnostic software" container.
 * @param {"online"|"processing"|"error"|"idle"} status
 */
export function TerminalFrame({
  title,
  status = "online",
  statusLabel = "ONLINE",
  actions,
  children,
  className = "",
  style,
}) {
  return (
    <div
      className={className}
      style={{
        border: "1px solid var(--color-forge-border)",
        background: "var(--color-forge-dark)",
        borderRadius: 2,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid var(--color-forge-border)",
          background: "var(--color-forge-black)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, background: "var(--color-forge-border)", flexShrink: 0 }} />
          <span style={{ width: 8, height: 8, background: "var(--color-forge-border)", flexShrink: 0 }} />
          <span style={{ width: 8, height: 8, background: "var(--color-copper)", flexShrink: 0 }} />
          <span
            className="mono-label"
            style={{ marginLeft: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {title}
          </span>
        </div>
        {actions || <StatusLED status={status} label={statusLabel} />}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}
