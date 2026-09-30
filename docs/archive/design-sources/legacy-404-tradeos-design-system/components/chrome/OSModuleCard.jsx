import React from "react";
import { StatusLED } from "../core/StatusLED.jsx";
import { CornerBrackets } from "./CornerBrackets.jsx";

/**
 * A service rendered as an "OS module": copper icon tile, MOD-0X id, body,
 * optional price/timeline row, and a RUNNING status footer. Corner brackets
 * fade in on hover.
 */
export function OSModuleCard({ icon, id, title, body, from, time, version = "v2.4", as = "a", className = "", style, ...rest }) {
  const Tag = as;
  const [hover, setHover] = React.useState(false);
  return (
    <Tag
      className={className}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "block",
        height: "100%",
        border: `1px solid ${hover ? "color-mix(in oklab, var(--color-copper) 50%, transparent)" : "var(--color-forge-border)"}`,
        background: "var(--color-forge-dark)",
        borderRadius: 2,
        padding: 20,
        overflow: "hidden",
        textDecoration: "none",
        transition: "border-color .2s",
        ...style,
      }}
      {...rest}
    >
      <div style={{ opacity: hover ? 1 : 0, transition: "opacity .2s" }}>
        <CornerBrackets size={14} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-forge-black)",
            background: "linear-gradient(135deg, var(--color-copper), var(--color-copper-dark))",
          }}
        >
          {icon}
        </div>
        <span className="mono-label">{id}</span>
      </div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          margin: "0 0 8px",
          color: hover ? "var(--color-copper-light)" : "var(--color-bone)",
          transition: "color .2s",
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-forge-muted)", margin: "0 0 16px" }}>{body}</p>

      {(from || time) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 12,
            borderTop: "1px solid var(--color-forge-border)",
            marginBottom: 12,
          }}
        >
          {from && (
            <div>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-forge-rust)" }}>from</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-copper)" }}>{from}</div>
            </div>
          )}
          {time && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-forge-rust)" }}>timeline</div>
              <div style={{ fontSize: 14, color: "var(--color-copper-light)" }}>{time}</div>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          ...(from || time ? {} : { paddingTop: 12, borderTop: "1px solid var(--color-forge-border)" }),
        }}
      >
        <StatusLED status="online" label="RUNNING" />
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-forge-rust)" }}>{version}</span>
      </div>
    </Tag>
  );
}
