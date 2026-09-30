/* @ds-bundle: {"format":4,"namespace":"Ds404TradeOSDesignSystem_f45b1c","components":[{"name":"Badge404","sourcePath":"components/brand/Badge404.jsx"},{"name":"Wordmark","sourcePath":"components/brand/Wordmark.jsx"},{"name":"CornerBrackets","sourcePath":"components/chrome/CornerBrackets.jsx"},{"name":"OSModuleCard","sourcePath":"components/chrome/OSModuleCard.jsx"},{"name":"TerminalFrame","sourcePath":"components/chrome/TerminalFrame.jsx"},{"name":"BlinkingCursor","sourcePath":"components/core/BlinkingCursor.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"SecLabel","sourcePath":"components/core/SecLabel.jsx"},{"name":"StatusLED","sourcePath":"components/core/StatusLED.jsx"},{"name":"StatusPill","sourcePath":"components/core/StatusPill.jsx"}],"sourceHashes":{"components/brand/Badge404.jsx":"1b23d151f042","components/brand/Wordmark.jsx":"c9cf9fb7a511","components/chrome/CornerBrackets.jsx":"4d3e1ee4b2ac","components/chrome/OSModuleCard.jsx":"e6b36fecbf3a","components/chrome/TerminalFrame.jsx":"93c3cf2dfc0d","components/core/BlinkingCursor.jsx":"11e427730721","components/core/Button.jsx":"3895ea7057af","components/core/Card.jsx":"a0e42de395ba","components/core/SecLabel.jsx":"148c896dbfbe","components/core/StatusLED.jsx":"8df6d3d94f28","components/core/StatusPill.jsx":"2bf2576b2765","ui_kits/costbook/app.jsx":"70498c8bdd42","ui_kits/marketing/Home.jsx":"444b89c264bf","ui_kits/marketing/decor.jsx":"a2e93df92a53","ui_kits/marketing/icons.jsx":"0a1a4ebe7253","ui_kits/marketing/parts.jsx":"72cea017f582","ui_kits/marketing/screens.jsx":"53883fae9816"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.Ds404TradeOSDesignSystem_f45b1c = window.Ds404TradeOSDesignSystem_f45b1c || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Badge404.jsx
try { (() => {
/**
 * The 404 · TRADE · OS logo badge — a monospace pill that always accompanies
 * the wordmark. "404" is part of the brand name and must never be dropped.
 */
function Badge404({
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
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
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-copper-light)"
    }
  }, "404"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      width: 1,
      height: 12,
      background: "var(--color-forge-border)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-copper)"
    }
  }, "TRADE"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      width: 1,
      height: 12,
      background: "var(--color-forge-border)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-copper-light)"
    }
  }, "OS"));
}
Object.assign(__ds_scope, { Badge404 });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Badge404.jsx", error: String((e && e.message) || e) }); }

// components/brand/Wordmark.jsx
try { (() => {
/**
 * The TradeOS wordmark — Space Grotesk logotype with a copper "OS" suffix.
 * @param {"sm"|"md"|"lg"|"xl"} size
 * @param {"dark"|"light"} tone  dark = bone text (on dark bg), light = forge-black text
 */
function Wordmark({
  size = "md",
  tone = "dark",
  className = "",
  style
}) {
  const sizes = {
    sm: 18,
    md: 24,
    lg: 32,
    xl: 46
  };
  const base = tone === "light" ? "var(--color-forge-black)" : "var(--color-bone)";
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: sizes[size] || sizes.md,
      letterSpacing: "-0.03em",
      lineHeight: 1,
      color: base,
      ...style
    }
  }, "Trade", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-copper)"
    }
  }, "OS"));
}
Object.assign(__ds_scope, { Wordmark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Wordmark.jsx", error: String((e && e.message) || e) }); }

// components/chrome/CornerBrackets.jsx
try { (() => {
/**
 * CNC-reticle corner ticks for any position:relative parent. Purely decorative.
 * @param {number} size  length of each bracket arm in px
 */
function CornerBrackets({
  size = 14,
  color = "var(--color-copper)",
  className = "",
  style
}) {
  const arm = {
    position: "absolute",
    stroke: color,
    strokeWidth: 1.25,
    fill: "none"
  };
  const s = size;
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      ...arm,
      top: 6,
      left: 6
    },
    width: s,
    height: s,
    viewBox: `0 0 ${s} ${s}`
  }, /*#__PURE__*/React.createElement("path", {
    d: `M0 ${s} L0 0 L${s} 0`
  })), /*#__PURE__*/React.createElement("svg", {
    style: {
      ...arm,
      top: 6,
      right: 6
    },
    width: s,
    height: s,
    viewBox: `0 0 ${s} ${s}`
  }, /*#__PURE__*/React.createElement("path", {
    d: `M0 0 L${s} 0 L${s} ${s}`
  })), /*#__PURE__*/React.createElement("svg", {
    style: {
      ...arm,
      bottom: 6,
      left: 6
    },
    width: s,
    height: s,
    viewBox: `0 0 ${s} ${s}`
  }, /*#__PURE__*/React.createElement("path", {
    d: `M0 0 L0 ${s} L${s} ${s}`
  })), /*#__PURE__*/React.createElement("svg", {
    style: {
      ...arm,
      bottom: 6,
      right: 6
    },
    width: s,
    height: s,
    viewBox: `0 0 ${s} ${s}`
  }, /*#__PURE__*/React.createElement("path", {
    d: `M${s} 0 L${s} ${s} L0 ${s}`
  })));
}
Object.assign(__ds_scope, { CornerBrackets });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chrome/CornerBrackets.jsx", error: String((e && e.message) || e) }); }

// components/core/BlinkingCursor.jsx
try { (() => {
/**
 * Blinking terminal cursor block. Respects prefers-reduced-motion (via .blink-cursor).
 */
function BlinkingCursor({
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: `blink-cursor ${className}`,
    "aria-hidden": "true",
    style: {
      display: "inline-block",
      width: "0.6em",
      height: "1.05em",
      marginLeft: 2,
      transform: "translateY(2px)",
      background: "var(--color-copper)",
      ...style
    }
  });
}
Object.assign(__ds_scope, { BlinkingCursor });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/BlinkingCursor.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Brand button. Three variants map to the production .btn-primary / .btn-outline / .btn-ghost.
 * Copper is the only fill; never introduce another accent.
 */
function Button({
  variant = "primary",
  as = "button",
  children,
  iconRight,
  iconLeft,
  className = "",
  style,
  ...rest
}) {
  const Tag = as;
  const shared = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    padding: "10px 22px",
    borderRadius: 6,
    cursor: "pointer",
    textDecoration: "none",
    fontFamily: "var(--font-sans)",
    transition: "background .15s, border-color .15s, color .15s, transform .08s, filter .08s"
  };
  const variants = {
    primary: {
      background: "var(--color-copper)",
      color: "var(--color-forge-black)",
      fontWeight: 600,
      border: "none"
    },
    outline: {
      background: "transparent",
      color: "var(--color-copper)",
      fontWeight: 500,
      border: "1.5px solid var(--color-copper)"
    },
    ghost: {
      background: "transparent",
      color: "var(--color-forge-muted)",
      fontWeight: 500,
      border: "1px solid var(--color-forge-border)"
    }
  };
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: className,
    style: {
      ...shared,
      ...(variants[variant] || variants.primary),
      ...style
    }
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Forge-dark surface card. `variant="panel"` is slightly larger radius + padding.
 * Industrial UI favors a 1px border over drop shadows.
 */
function Card({
  variant = "card",
  children,
  className = "",
  style,
  ...rest
}) {
  const isPanel = variant === "panel";
  return /*#__PURE__*/React.createElement("div", _extends({
    className: className,
    style: {
      background: "var(--color-forge-dark)",
      border: "1px solid var(--color-forge-border)",
      borderRadius: isPanel ? 14 : 12,
      padding: isPanel ? 28 : 24,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/SecLabel.jsx
try { (() => {
/**
 * Section eyebrow — a copper monospace label that precedes every h2.
 */
function SecLabel({
  children,
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--color-copper)",
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      display: "block",
      marginBottom: 8,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { SecLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SecLabel.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusLED.jsx
try { (() => {
const COLORS = {
  online: "var(--color-system-green)",
  processing: "var(--color-copper)",
  error: "var(--color-error-red)",
  idle: "var(--color-forge-rust)"
};

/**
 * Pulsing status dot + monospace label. `online` is the only state that uses green.
 * @param {"online"|"processing"|"error"|"idle"} status
 */
function StatusLED({
  status = "online",
  label,
  className = "",
  style
}) {
  const color = COLORS[status] || COLORS.online;
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: status !== "idle" ? "led-pulse" : "",
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      flexShrink: 0,
      background: color,
      boxShadow: `0 0 6px ${color}`
    }
  }), label);
}
Object.assign(__ds_scope, { StatusLED });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusLED.jsx", error: String((e && e.message) || e) }); }

// components/chrome/OSModuleCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A service rendered as an "OS module": copper icon tile, MOD-0X id, body,
 * optional price/timeline row, and a RUNNING status footer. Corner brackets
 * fade in on hover.
 */
function OSModuleCard({
  icon,
  id,
  title,
  body,
  from,
  time,
  version = "v2.4",
  as = "a",
  className = "",
  style,
  ...rest
}) {
  const Tag = as;
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: className,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
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
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      opacity: hover ? 1 : 0,
      transition: "opacity .2s"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.CornerBrackets, {
    size: 14
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--color-forge-black)",
      background: "linear-gradient(135deg, var(--color-copper), var(--color-copper-dark))"
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    className: "mono-label"
  }, id)), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      margin: "0 0 8px",
      color: hover ? "var(--color-copper-light)" : "var(--color-bone)",
      transition: "color .2s"
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      lineHeight: 1.6,
      color: "var(--color-forge-muted)",
      margin: "0 0 16px"
    }
  }, body), (from || time) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 12,
      borderTop: "1px solid var(--color-forge-border)",
      marginBottom: 12
    }
  }, from && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      color: "var(--color-forge-rust)"
    }
  }, "from"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "var(--color-copper)"
    }
  }, from)), time && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      color: "var(--color-forge-rust)"
    }
  }, "timeline"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--color-copper-light)"
    }
  }, time))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      ...(from || time ? {} : {
        paddingTop: 12,
        borderTop: "1px solid var(--color-forge-border)"
      })
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.StatusLED, {
    status: "online",
    label: "RUNNING"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      color: "var(--color-forge-rust)"
    }
  }, version)));
}
Object.assign(__ds_scope, { OSModuleCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chrome/OSModuleCard.jsx", error: String((e && e.message) || e) }); }

// components/chrome/TerminalFrame.jsx
try { (() => {
/**
 * Window-chrome shell: two dim square lights + a copper light, a mono title,
 * and a StatusLED. The core "diagnostic software" container.
 * @param {"online"|"processing"|"error"|"idle"} status
 */
function TerminalFrame({
  title,
  status = "online",
  statusLabel = "ONLINE",
  actions,
  children,
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: {
      border: "1px solid var(--color-forge-border)",
      background: "var(--color-forge-dark)",
      borderRadius: 2,
      overflow: "hidden",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "10px 16px",
      borderBottom: "1px solid var(--color-forge-border)",
      background: "var(--color-forge-black)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      background: "var(--color-forge-border)",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      background: "var(--color-forge-border)",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      background: "var(--color-copper)",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mono-label",
    style: {
      marginLeft: 8,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, title)), actions || /*#__PURE__*/React.createElement(__ds_scope.StatusLED, {
    status: status,
    label: statusLabel
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, children));
}
Object.assign(__ds_scope, { TerminalFrame });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chrome/TerminalFrame.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusPill.jsx
try { (() => {
/**
 * Rounded status pill. `tone="online"` is the green success pill; `mono` is a
 * neutral rust label chip. Green is reserved for online/success only.
 * @param {"online"|"neutral"|"copper"} tone
 */
function StatusPill({
  tone = "online",
  dot = true,
  children,
  className = "",
  style
}) {
  const tones = {
    online: {
      color: "var(--color-system-green)",
      background: "rgba(0,200,150,0.1)",
      border: "1px solid rgba(0,200,150,0.3)"
    },
    copper: {
      color: "var(--color-copper-light)",
      background: "rgba(184,115,51,0.12)",
      border: "1px solid rgba(184,115,51,0.35)"
    },
    neutral: {
      color: "var(--color-forge-rust)",
      background: "transparent",
      border: "1px solid var(--color-forge-border)"
    }
  };
  const t = tones[tone] || tones.online;
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      letterSpacing: "0.04em",
      borderRadius: 999,
      padding: "3px 10px",
      ...t,
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: t.color,
      flexShrink: 0
    }
  }), children);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusPill.jsx", error: String((e && e.message) || e) }); }

// ui_kits/costbook/app.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* TradeOS CostBook — internal estimating/invoicing app.
   Neutral shadcn/ui styling (light, grayscale) — intentionally NOT the copper brand. */
const {
  useState
} = React;
const Plus = ({
  size = 15
}) => /*#__PURE__*/React.createElement("svg", {
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M12 5v14M5 12h14"
}));
const C = {
  bg: "#ffffff",
  muted: "#f6f6f6",
  fg: "#252525",
  mutedFg: "#737373",
  border: "#e6e6e6",
  primary: "#252525",
  primaryFg: "#fafafa",
  radius: 10,
  green: "#16a34a",
  amber: "#d97706",
  blue: "#2563eb",
  red: "#dc2626",
  font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
};
function Btn({
  variant = "default",
  size = "default",
  children,
  ...p
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontFamily: C.font,
    fontSize: size === "sm" ? 13 : 14,
    fontWeight: 500,
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid transparent",
    padding: size === "sm" ? "5px 10px" : "8px 14px",
    whiteSpace: "nowrap",
    transition: "background .15s"
  };
  const v = {
    default: {
      background: C.primary,
      color: C.primaryFg
    },
    outline: {
      background: C.bg,
      color: C.fg,
      borderColor: C.border
    },
    ghost: {
      background: "transparent",
      color: C.fg
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", _extends({
    style: {
      ...base,
      ...v
    }
  }, p), children);
}
function Badge({
  tone = "muted",
  children
}) {
  const tones = {
    muted: {
      bg: C.muted,
      fg: C.mutedFg,
      bd: C.border
    },
    green: {
      bg: "#f0fdf4",
      fg: C.green,
      bd: "#bbf7d0"
    },
    amber: {
      bg: "#fffbeb",
      fg: C.amber,
      bd: "#fde68a"
    },
    blue: {
      bg: "#eff6ff",
      fg: C.blue,
      bd: "#bfdbfe"
    }
  }[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      fontSize: 12,
      fontWeight: 500,
      padding: "2px 9px",
      borderRadius: 999,
      background: tones.bg,
      color: tones.fg,
      border: `1px solid ${tones.bd}`,
      fontFamily: C.font
    }
  }, children);
}
function Card({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: C.radius,
      ...style
    }
  }, children);
}
const STATUS = {
  lead: "muted",
  estimating: "amber",
  active: "blue",
  won: "green",
  completed: "green"
};
const PROJECTS = [{
  id: 1,
  name: "Maple St. bathroom remodel",
  customer: "R. Delgado",
  status: "active",
  value: "$14,200"
}, {
  id: 2,
  name: "Warehouse panel upgrade",
  customer: "Terre Haute Storage",
  status: "estimating",
  value: "$8,750"
}, {
  id: 3,
  name: "Rooftop HVAC replacement (x3)",
  customer: "Wabash Property Mgmt",
  status: "won",
  value: "$31,400"
}, {
  id: 4,
  name: "New construction rough-in",
  customer: "Lucas Construction",
  status: "active",
  value: "$52,900"
}, {
  id: 5,
  name: "Water heater swap",
  customer: "J. Okafor",
  status: "lead",
  value: "$2,300"
}, {
  id: 6,
  name: "Restaurant grease-trap line",
  customer: "Sycamore Diner",
  status: "completed",
  value: "$6,100"
}];
const LINE_ITEMS = [["Demo & haul-away", "1 job", "$1,200", "$1,200"], ['3/4" copper supply lines', "180 ft", "$4.20", "$756"], ["Fixture set — tub/shower", "1 ea", "$2,450", "$2,450"], ["Labor — journeyman", "48 hr", "$95", "$4,560"], ["Permit & inspection", "1 ea", "$340", "$340"]];
function Nav({
  page,
  go,
  email
}) {
  const links = [["dashboard", "Dashboard"], ["customers", "Customers"], ["projects", "Projects"]];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `1px solid ${C.border}`,
      padding: "12px 24px",
      background: C.bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: 15,
      color: C.fg
    }
  }, "TradeOS ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.mutedFg,
      fontWeight: 500
    }
  }, "CostBook")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: 16,
      fontSize: 14
    }
  }, links.map(([k, l]) => /*#__PURE__*/React.createElement("a", {
    key: k,
    onClick: () => go(k),
    style: {
      cursor: "pointer",
      color: page === k ? C.fg : C.mutedFg,
      fontWeight: page === k ? 500 : 400
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontSize: 13,
      color: C.mutedFg
    }
  }, /*#__PURE__*/React.createElement("span", null, email), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "sm",
    onClick: () => go("login")
  }, "Sign out")));
}
function Dashboard({
  go
}) {
  const stats = [["Open projects", "4"], ["Estimating", "1"], ["Won this month", "$31,400"], ["Customers", "12"]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: h1s
  }, "Dashboard"), /*#__PURE__*/React.createElement("p", {
    style: subs
  }, "Signed in as billy@404tradeos.com \xB7 role: owner")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 16
    },
    className: "cb-stats"
  }, stats.map(([k, v]) => /*#__PURE__*/React.createElement(Card, {
    key: k,
    style: {
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mutedFg,
      marginBottom: 6
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 600,
      color: C.fg
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    },
    className: "cb-2col"
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      marginBottom: 6,
      color: C.fg
    }
  }, "Customers"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...subs,
      marginBottom: 16
    }
  }, "Manage the people and companies you bid work for."), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "sm",
    onClick: () => go("customers")
  }, "View customers")), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      marginBottom: 6,
      color: C.fg
    }
  }, "Projects"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...subs,
      marginBottom: 16
    }
  }, "Track jobs from lead through estimate to completion."), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "sm",
    onClick: () => go("projects")
  }, "View projects"))));
}
function Projects({
  go,
  open
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: h1s
  }, "Projects"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => go("new")
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 15
  }), "New project")), /*#__PURE__*/React.createElement(Card, null, PROJECTS.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    onClick: () => open(p),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 18px",
      borderTop: i ? `1px solid ${C.border}` : "none",
      cursor: "pointer"
    },
    onMouseEnter: e => e.currentTarget.style.background = C.muted,
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: C.fg
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mutedFg,
      marginTop: 2
    }
  }, p.customer)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.fg,
      fontVariantNumeric: "tabular-nums"
    }
  }, p.value), /*#__PURE__*/React.createElement(Badge, {
    tone: STATUS[p.status]
  }, p.status))))));
}
function ProjectDetail({
  back,
  project
}) {
  const [tab, setTab] = useState("Estimate");
  const tabs = ["Estimate", "Proposal", "Contract", "Invoices"];
  const total = "$9,306";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("a", {
    onClick: back,
    style: {
      fontSize: 13,
      color: C.mutedFg,
      cursor: "pointer"
    }
  }, "\u2190 Projects"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: h1s
  }, project.name), /*#__PURE__*/React.createElement(Badge, {
    tone: STATUS[project.status]
  }, project.status)), /*#__PURE__*/React.createElement("p", {
    style: subs
  }, project.customer, " \xB7 Project #", project.id)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      borderBottom: `1px solid ${C.border}`
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setTab(t),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: C.font,
      fontSize: 14,
      padding: "8px 12px",
      color: tab === t ? C.fg : C.mutedFg,
      fontWeight: tab === t ? 500 : 400,
      borderBottom: `2px solid ${tab === t ? C.fg : "transparent"}`,
      marginBottom: -1
    }
  }, t))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "2.4fr 1fr 1fr 1fr",
      padding: "10px 18px",
      borderBottom: `1px solid ${C.border}`,
      fontSize: 12,
      color: C.mutedFg,
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: "0.04em"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Item"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "Qty"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "Unit"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "Total")), LINE_ITEMS.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "grid",
      gridTemplateColumns: "2.4fr 1fr 1fr 1fr",
      padding: "12px 18px",
      borderTop: i ? `1px solid ${C.border}` : "none",
      fontSize: 14,
      color: C.fg
    }
  }, /*#__PURE__*/React.createElement("span", null, r[0]), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right",
      color: C.mutedFg,
      fontVariantNumeric: "tabular-nums"
    }
  }, r[1]), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right",
      color: C.mutedFg,
      fontVariantNumeric: "tabular-nums"
    }
  }, r[2]), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right",
      fontVariantNumeric: "tabular-nums"
    }
  }, r[3]))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 18px",
      borderTop: `2px solid ${C.border}`,
      background: C.muted
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mutedFg
    }
  }, "Subtotal \xB7 materials + labor"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      color: C.fg,
      fontVariantNumeric: "tabular-nums"
    }
  }, total))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Btn, null, "Send ", tab.toLowerCase()), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline"
  }, "Add line item"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost"
  }, "Export PDF")));
}
function NewProject({
  back
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 480,
      display: "flex",
      flexDirection: "column",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("a", {
    onClick: back,
    style: {
      fontSize: 13,
      color: C.mutedFg,
      cursor: "pointer"
    }
  }, "\u2190 Projects"), /*#__PURE__*/React.createElement("h1", {
    style: {
      ...h1s,
      marginTop: 8
    }
  }, "New project")), [["Project name", "e.g. Maple St. bathroom remodel"], ["Customer", "Search or add a customer"], ["Estimated value", "$0.00"]].map(([l, ph]) => /*#__PURE__*/React.createElement("label", {
    key: l,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: C.fg
    }
  }, l), /*#__PURE__*/React.createElement("input", {
    placeholder: ph,
    style: {
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "9px 12px",
      fontSize: 14,
      fontFamily: C.font,
      color: C.fg,
      outline: "none"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: back
  }, "Create project"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    onClick: back
  }, "Cancel")));
}
function Customers() {
  const rows = [["R. Delgado", "Homeowner", "2 projects"], ["Lucas Construction", "GC · Terre Haute", "5 projects"], ["Wabash Property Mgmt", "Commercial", "3 projects"], ["Sycamore Diner", "Commercial", "1 project"], ["J. Okafor", "Homeowner", "1 project"]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: h1s
  }, "Customers"), /*#__PURE__*/React.createElement(Btn, null, /*#__PURE__*/React.createElement(Plus, {
    size: 15
  }), "New customer")), /*#__PURE__*/React.createElement(Card, null, rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 18px",
      borderTop: i ? `1px solid ${C.border}` : "none"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: C.fg
    }
  }, r[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mutedFg,
      marginTop: 2
    }
  }, r[1])), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mutedFg
    }
  }, r[2])))));
}
function Login({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: C.muted
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 32,
      width: 360
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 18,
      color: C.fg
    }
  }, "TradeOS ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.mutedFg,
      fontWeight: 500
    }
  }, "CostBook")), /*#__PURE__*/React.createElement("p", {
    style: {
      ...subs,
      marginTop: 4,
      marginBottom: 22
    }
  }, "Sign in to your workspace."), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      go("dashboard");
    },
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, [["Email", "billy@404tradeos.com", "email"], ["Password", "••••••••", "password"]].map(([l, ph, ty]) => /*#__PURE__*/React.createElement("label", {
    key: l,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: C.fg
    }
  }, l), /*#__PURE__*/React.createElement("input", {
    type: ty,
    defaultValue: ty === "email" ? ph : "",
    placeholder: ph,
    style: {
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "9px 12px",
      fontSize: 14,
      fontFamily: C.font,
      color: C.fg,
      outline: "none"
    }
  }))), /*#__PURE__*/React.createElement(Btn, {
    style: {
      marginTop: 4
    }
  }, "Sign in"))));
}
function App() {
  const [page, setPage] = useState("dashboard");
  const [project, setProject] = useState(PROJECTS[0]);
  const go = p => {
    setPage(p);
    window.scrollTo(0, 0);
  };
  const open = p => {
    setProject(p);
    setPage("detail");
    window.scrollTo(0, 0);
  };
  if (page === "login") return /*#__PURE__*/React.createElement(Login, {
    go: go
  });
  const body = {
    dashboard: /*#__PURE__*/React.createElement(Dashboard, {
      go: go
    }),
    projects: /*#__PURE__*/React.createElement(Projects, {
      go: go,
      open: open
    }),
    detail: /*#__PURE__*/React.createElement(ProjectDetail, {
      back: () => go("projects"),
      project: project
    }),
    new: /*#__PURE__*/React.createElement(NewProject, {
      back: () => go("projects")
    }),
    customers: /*#__PURE__*/React.createElement(Customers, null)
  }[page] || /*#__PURE__*/React.createElement(Dashboard, {
    go: go
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: C.bg,
      fontFamily: C.font,
      color: C.fg
    }
  }, /*#__PURE__*/React.createElement(Nav, {
    page: page === "detail" || page === "new" ? "projects" : page,
    go: go,
    email: "billy@404tradeos.com"
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: 900,
      margin: "0 auto",
      padding: "32px 24px"
    }
  }, body));
}
const h1s = {
  fontSize: 24,
  fontWeight: 600,
  margin: 0,
  color: C.fg,
  fontFamily: C.font
};
const subs = {
  fontSize: 14,
  color: C.mutedFg,
  margin: "4px 0 0",
  fontFamily: C.font
};
Object.assign(window, {
  CostBookApp: App
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/costbook/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/Home.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Marketing screens: Home, Services, Pricing, Contact */
const {
  useState
} = React;
function ControlCenter() {
  const metrics = [{
    k: "Leads this month",
    v: "47",
    delta: "↑ 18%",
    points: "0,16 8,15 16,12 24,13 32,9 40,7 48,3"
  }, {
    k: "Calls tracked",
    v: "22",
    delta: "↑ 27%",
    points: "0,17 8,14 16,15 24,11 32,10 40,6 48,4"
  }, {
    k: "Quote requests",
    v: "13",
    delta: "↑ 8%",
    points: "0,12 8,13 16,10 24,11 32,8 40,9 48,5"
  }, {
    k: "Reviews gained",
    v: "+8",
    delta: "↑ 33%",
    points: "0,18 8,16 16,13 24,10 32,8 40,5 48,2"
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "crt-hover",
    style: {
      border: "1px solid var(--color-forge-border)",
      background: "rgba(30,22,16,0.95)",
      backdropFilter: "blur(6px)",
      borderRadius: 2,
      overflow: "hidden",
      boxShadow: "var(--shadow-panel)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 16px",
      borderBottom: "1px solid var(--color-forge-border)",
      background: "rgba(13,10,7,0.9)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono-label"
  }, "TradeOS ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-copper)"
    }
  }, "Control Center")), /*#__PURE__*/React.createElement("span", {
    className: "status-online"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "var(--color-system-green)"
    },
    className: "led-pulse"
  }), "Status: Online")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      borderBottom: "1px solid var(--color-forge-border)"
    }
  }, metrics.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: m.k,
    style: {
      padding: 12,
      borderRight: i < 3 ? "1px solid var(--color-forge-border)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono-label",
    style: {
      marginBottom: 6,
      fontSize: 9
    }
  }, m.k), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 600,
      color: "var(--color-bone)",
      lineHeight: 1
    }
  }, m.v), /*#__PURE__*/React.createElement(Sparkline, {
    points: m.points
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: "var(--color-system-green)",
      marginTop: 4
    }
  }, m.delta)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono-label",
    style: {
      marginBottom: 8,
      fontSize: 9
    }
  }, "Recent activity"), [["New lead from website", "2m ago"], ["Quote request submitted", "15m ago"], ["Google review received", "32m ago"], ["Phone call tracked", "42m ago"]].map(([l, t]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 8,
      fontSize: 11,
      marginBottom: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-forge-muted)"
    }
  }, l), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-forge-rust)"
    }
  }, t)))));
}
function Home({
  go
}) {
  const heroFeatures = [{
    icon: /*#__PURE__*/React.createElement(Target, {
      size: 16
    }),
    title: "Built for trades",
    body: "We understand your business."
  }, {
    icon: /*#__PURE__*/React.createElement(Zap, {
      size: 16
    }),
    title: "Results that matter",
    body: "More calls. More leads. More jobs."
  }, {
    icon: /*#__PURE__*/React.createElement(MapPin, {
      size: 16
    }),
    title: "Local. Reliable. Real.",
    body: "Terre Haute, IN. Serving the Midwest."
  }];
  const services = [{
    id: "MOD-01",
    icon: /*#__PURE__*/React.createElement(Smartphone, {
      size: 18
    }),
    title: "Website design",
    body: "Custom sites built for trade businesses. Fast, mobile-first, designed to convert visitors into booked jobs."
  }, {
    id: "MOD-02",
    icon: /*#__PURE__*/React.createElement(Search, {
      size: 18
    }),
    title: "Local SEO",
    body: "Get found on Google Maps and organic search when customers search for your trade in your area."
  }, {
    id: "MOD-03",
    icon: /*#__PURE__*/React.createElement(Phone, {
      size: 18
    }),
    title: "Lead capture",
    body: "Smart forms, click-to-call, and booking widgets that turn visitors into paying customers."
  }, {
    id: "MOD-04",
    icon: /*#__PURE__*/React.createElement(BarChart, {
      size: 18
    }),
    title: "Google Ads",
    body: "Paid search campaigns that put you at the top of Google the same day we launch."
  }, {
    id: "MOD-05",
    icon: /*#__PURE__*/React.createElement(Star, {
      size: 18
    }),
    title: "Review management",
    body: "Automated review requests that grow your Google rating on autopilot after every job."
  }, {
    id: "MOD-06",
    icon: /*#__PURE__*/React.createElement(RefreshCw, {
      size: 18
    }),
    title: "Ongoing support",
    body: "Monthly hosting, security, updates, and reports so you never worry about your site again."
  }];
  const process = [{
    title: "Discovery call",
    body: "We learn your trade, service area, and competitors in 30 minutes.",
    time: "Day 1"
  }, {
    title: "Design & build",
    body: "Custom design, trade-specific copy, full SEO setup. You approve before launch.",
    time: "Week 1–2"
  }, {
    title: "Review & revise",
    body: "Two rounds of revisions included. We don't launch until you're satisfied.",
    time: "Week 2–3"
  }, {
    title: "Launch & rank",
    body: "Domain, hosting, SSL, Google Business — all handled. Live in 30 days.",
    time: "Week 2–4"
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    style: {
      position: "relative",
      minHeight: "88vh",
      display: "flex",
      alignItems: "center",
      overflow: "hidden",
      background: "var(--color-forge-black)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/images/hero/contractor-truck-jobsite.jpg",
    alt: "Contractor at a jobsite",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: "linear-gradient(90deg, rgba(13,10,7,0.97) 0%, rgba(13,10,7,0.88) 28%, rgba(13,10,7,0.45) 52%, rgba(13,10,7,0.15) 70%, transparent 85%), linear-gradient(180deg, transparent 55%, rgba(13,10,7,0.9) 100%)",
      zIndex: 2
    }
  }), /*#__PURE__*/React.createElement(HeroBackground, null), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: "0 auto",
      width: "100%",
      padding: "0 24px",
      position: "relative",
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-grid",
    style: {
      display: "grid",
      gridTemplateColumns: "1fr minmax(0,540px)",
      gap: 40,
      alignItems: "end"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mono-label fade-up",
    style: {
      marginBottom: 16
    }
  }, "Websites. SEO. Leads. Growth."), /*#__PURE__*/React.createElement("h1", {
    className: "fade-up fade-up-delay-1",
    style: {
      fontSize: 58,
      color: "var(--color-bone)",
      lineHeight: 1.05,
      letterSpacing: "-0.02em",
      margin: "0 0 20px",
      textTransform: "uppercase",
      textWrap: "balance"
    }
  }, "Stop being a 404.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-copper)"
    }
  }, "Start getting found.")), /*#__PURE__*/React.createElement("p", {
    className: "fade-up fade-up-delay-2",
    style: {
      fontSize: 18,
      color: "var(--color-forge-muted)",
      lineHeight: 1.6,
      margin: "0 0 32px",
      maxWidth: 480
    }
  }, "High-performance websites and marketing systems that get trade businesses more calls, more leads, and more jobs."), /*#__PURE__*/React.createElement("div", {
    className: "fade-up fade-up-delay-3",
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 40
    }
  }, /*#__PURE__*/React.createElement("a", {
    onClick: () => go("contact"),
    className: "btn-primary"
  }, "Get a quote ", /*#__PURE__*/React.createElement(Target, {
    size: 16
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("work"),
    className: "btn-outline"
  }, "See our work ", /*#__PURE__*/React.createElement(ArrowRight, {
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    className: "fade-up fade-up-delay-3 hero-feats",
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 24,
      maxWidth: 560
    }
  }, heroFeatures.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.title,
    style: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-copper)",
      marginTop: 2,
      flexShrink: 0
    }
  }, f.icon), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "var(--color-bone)"
    }
  }, f.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--color-forge-muted)",
      lineHeight: 1.4
    }
  }, f.body)))))), /*#__PURE__*/React.createElement("div", {
    className: "hero-panel fade-in-right"
  }, /*#__PURE__*/React.createElement(ControlCenter, null))))), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: "40px 24px",
      borderBottom: "1px solid var(--color-forge-border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1000,
      margin: "0 auto",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono-label",
    style: {
      marginBottom: 18
    }
  }, "Trusted by trade businesses across the Midwest"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 14
    }
  }, ["Plumbers", "Electricians", "HVAC", "Roofers", "Contractors"].map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--color-forge-muted)",
      border: "1px solid var(--color-forge-border)",
      borderRadius: 999,
      padding: "6px 16px"
    }
  }, t))))), /*#__PURE__*/React.createElement("section", {
    className: "section-pad",
    style: {
      background: "var(--color-forge-dark)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: 40,
      flexWrap: "wrap",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "sec-label"
  }, "Installed modules"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 36,
      color: "var(--color-bone)",
      margin: 0,
      lineHeight: 1.1
    }
  }, "Everything your trade", /*#__PURE__*/React.createElement("br", null), "business needs online")), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("services"),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      fontSize: 14,
      color: "var(--color-copper)",
      cursor: "pointer",
      fontFamily: "var(--font-mono)"
    }
  }, "View all ", /*#__PURE__*/React.createElement(ArrowRight, {
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    className: "svc-grid",
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 16
    }
  }, services.map(s => /*#__PURE__*/React.createElement(OSModuleCard, _extends({
    key: s.id
  }, s, {
    onClick: () => go("services")
  })))))), /*#__PURE__*/React.createElement("section", {
    className: "section-pad",
    style: {
      background: "var(--color-forge-black)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-label"
  }, "How it works"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 36,
      color: "var(--color-bone)",
      margin: "0 0 40px",
      lineHeight: 1.1
    }
  }, "Done for you. Built right.", /*#__PURE__*/React.createElement("br", null), "No shortcuts."), /*#__PURE__*/React.createElement("div", {
    className: "proc-grid",
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 16
    }
  }, process.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: p.title,
    style: {
      border: "1px solid var(--color-forge-border)",
      background: "var(--color-forge-dark)",
      borderRadius: 2,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 700,
      color: "rgba(184,115,51,0.3)",
      fontFamily: "var(--font-display)",
      marginBottom: 14
    }
  }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: "var(--color-bone)",
      margin: "0 0 8px"
    }
  }, p.title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--color-forge-muted)",
      lineHeight: 1.6,
      margin: "0 0 14px"
    }
  }, p.body), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      fontSize: 11,
      fontFamily: "var(--font-mono)",
      color: "var(--color-system-green)",
      background: "rgba(0,200,150,0.1)",
      border: "1px solid rgba(0,200,150,0.3)",
      borderRadius: 999,
      padding: "3px 12px"
    }
  }, p.time)))))), /*#__PURE__*/React.createElement("section", {
    className: "section-pad",
    style: {
      background: "var(--color-forge-dark)",
      borderTop: "1px solid var(--color-forge-border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: "0 auto",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-label",
    style: {
      textAlign: "center"
    }
  }, "Client results"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: 2,
      margin: "0 0 16px"
    }
  }, [...Array(5)].map((_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      color: "var(--color-copper)"
    }
  }, /*#__PURE__*/React.createElement(Star, {
    size: 16,
    fill: "var(--color-copper)"
  })))), /*#__PURE__*/React.createElement("blockquote", {
    style: {
      fontSize: 24,
      color: "var(--color-bone)",
      lineHeight: 1.4,
      fontWeight: 500,
      margin: "0 0 16px"
    }
  }, "\"Within 3 weeks of launching I was ranking #1 for plumber in my city. Phones haven't stopped ringing since.\""), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 13,
      color: "var(--color-forge-rust)"
    }
  }, "Jake S. \u2014 Plumber, Indianapolis, IN"))), /*#__PURE__*/React.createElement("section", {
    className: "section-pad",
    style: {
      background: "var(--color-forge-black)",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 620,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(Badge, null)), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 38,
      color: "var(--color-bone)",
      margin: "0 0 16px",
      lineHeight: 1.1
    }
  }, "Stop being a ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-copper)"
    }
  }, "404"), ".", /*#__PURE__*/React.createElement("br", null), "Start getting found."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--color-forge-muted)",
      lineHeight: 1.6,
      margin: "0 0 32px"
    }
  }, "Free 30-minute discovery call. No contracts, no pressure. Just a website that works as hard as you do."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      justifyContent: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("a", {
    onClick: () => go("contact"),
    className: "btn-primary"
  }, "Book a free call ", /*#__PURE__*/React.createElement(ArrowRight, {
    size: 16
  })), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("pricing"),
    className: "btn-ghost"
  }, "See pricing")))));
}

/* OSModuleCard — local copy (mirrors the DS component) */
function OSModuleCard({
  icon,
  id,
  title,
  body,
  onClick
}) {
  const [h, setH] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    className: "crt-hover",
    style: {
      position: "relative",
      cursor: "pointer",
      border: `1px solid ${h ? "rgba(184,115,51,0.5)" : "var(--color-forge-border)"}`,
      background: "var(--color-forge-dark)",
      borderRadius: 2,
      padding: 20,
      transition: "border-color .2s",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--color-forge-black)",
      background: "linear-gradient(135deg, var(--color-copper), var(--color-copper-dark))"
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    className: "mono-label"
  }, id)), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: h ? "var(--color-copper-light)" : "var(--color-bone)",
      margin: "0 0 8px",
      transition: "color .2s"
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: "var(--color-forge-muted)",
      lineHeight: 1.6,
      margin: "0 0 16px"
    }
  }, body), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 12,
      borderTop: "1px solid var(--color-forge-border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      textTransform: "uppercase",
      color: "var(--color-system-green)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "led-pulse",
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "var(--color-system-green)",
      boxShadow: "0 0 6px var(--color-system-green)"
    }
  }), "RUNNING"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      color: "var(--color-forge-rust)"
    }
  }, "v2.4")));
}
Object.assign(window, {
  Home
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/Home.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/decor.jsx
try { (() => {
/* Live industrial motifs for the marketing kit — ported 1:1 from the source
   (CustomCursor + HeroBackground). All guard on fine-pointer + reduced-motion. */

/** CNC reticle cursor: dot + ring with corner ticks. Expands over interactive
 *  elements, shrinks on press. Mount once at app root. */
function CustomCursor() {
  const dotRef = React.useRef(null);
  const ringRef = React.useRef(null);
  React.useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(pointer: fine)").matches;
    if (reduce || !fine) return;
    const root = document.documentElement;
    root.classList.add("custom-cursor-active");
    let raf = null,
      x = -100,
      y = -100;
    const apply = () => {
      raf = null;
      if (dotRef.current) dotRef.current.style.transform = `translate3d(${x}px,${y}px,0)`;
      if (ringRef.current) ringRef.current.style.transform = `translate3d(${x}px,${y}px,0)`;
    };
    const queue = () => {
      if (raf === null) raf = requestAnimationFrame(apply);
    };
    const move = e => {
      x = e.clientX;
      y = e.clientY;
      queue();
    };
    const over = e => {
      const it = e.target.closest("a,button,input,select,textarea,[role='button']");
      ringRef.current?.classList.toggle("cursor-ring-active", !!it);
    };
    const down = () => ringRef.current?.classList.add("cursor-ring-pressed");
    const up = () => ringRef.current?.classList.remove("cursor-ring-pressed");
    addEventListener("mousemove", move, {
      passive: true
    });
    addEventListener("mouseover", over, {
      passive: true
    });
    addEventListener("mousedown", down, {
      passive: true
    });
    addEventListener("mouseup", up, {
      passive: true
    });
    return () => {
      root.classList.remove("custom-cursor-active");
      removeEventListener("mousemove", move);
      removeEventListener("mouseover", over);
      removeEventListener("mousedown", down);
      removeEventListener("mouseup", up);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("div", {
    ref: dotRef,
    className: "custom-cursor-dot"
  }), /*#__PURE__*/React.createElement("div", {
    ref: ringRef,
    className: "custom-cursor-ring"
  }, /*#__PURE__*/React.createElement("span", {
    className: "custom-cursor-tick custom-cursor-tick-t"
  }), /*#__PURE__*/React.createElement("span", {
    className: "custom-cursor-tick custom-cursor-tick-r"
  }), /*#__PURE__*/React.createElement("span", {
    className: "custom-cursor-tick custom-cursor-tick-b"
  }), /*#__PURE__*/React.createElement("span", {
    className: "custom-cursor-tick custom-cursor-tick-l"
  })));
}

/** Hero background: grid + scanlines + ember mesh + cursor-tracked CNC crosshair,
 *  scan ring, and coordinate readout. Fills its (relative) parent. */
function HeroBackground() {
  const box = React.useRef(null);
  const coord = React.useRef(null);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(pointer: fine)").matches;
    if (reduce || !fine) return;
    let raf = null,
      x = 0,
      y = 0,
      nx = 0,
      ny = 0;
    const apply = () => {
      raf = null;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      if (coord.current) coord.current.textContent = `X:${nx.toFixed(3)} Y:${ny.toFixed(3)}`;
    };
    const move = e => {
      const r = el.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      nx = x / r.width;
      ny = y / r.height;
      if (raf === null) raf = requestAnimationFrame(apply);
    };
    addEventListener("mousemove", move, {
      passive: true
    });
    return () => {
      removeEventListener("mousemove", move);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);
  const particles = Array.from({
    length: 22
  }, (_, i) => ({
    left: i * 137.508 % 100,
    top: i * 53 % 100,
    size: 2 + i % 4,
    dur: 8 + i % 6 * 2,
    delay: -(i % 8 * 0.9)
  }));
  return /*#__PURE__*/React.createElement("div", {
    ref: box,
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      userSelect: "none",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid-overlay",
    style: {
      position: "absolute",
      inset: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "scanline-overlay",
    style: {
      position: "absolute",
      inset: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero-crosshair-h"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero-crosshair-v"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero-scan-ring"
  }), /*#__PURE__*/React.createElement("span", {
    ref: coord,
    className: "hero-coord-readout"
  }), particles.map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      position: "absolute",
      left: `${p.left}%`,
      top: `${p.top}%`,
      width: p.size,
      height: p.size,
      borderRadius: 1,
      background: "var(--color-copper-light)",
      opacity: 0.35
    }
  })));
}
Object.assign(window, {
  CustomCursor,
  HeroBackground
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/decor.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/icons.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Lucide-style inline icons (stroke 2, round caps) — the sanctioned icon set.
   Self-contained so the kit renders without a CDN. */
const Ico = ({
  d,
  size = 18,
  fill = "none",
  ...p
}) => /*#__PURE__*/React.createElement("svg", _extends({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: fill,
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, p), typeof d === "string" ? /*#__PURE__*/React.createElement("path", {
  d: d
}) : d);
const ArrowRight = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: "M5 12h14M12 5l7 7-7 7"
}));
const Target = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "2"
  }))
}));
const Zap = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: "M4 14h7l-1 7 9-11h-7l1-7-9 11z"
}));
const MapPin = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "10",
    r: "3"
  }))
}));
const Phone = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"
}));
const Search = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.3-4.3"
  }))
}));
const BarChart = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M3 3v18h18"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7",
    y: "12",
    width: "3",
    height: "6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "12",
    y: "8",
    width: "3",
    height: "10"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "17",
    y: "5",
    width: "3",
    height: "13"
  }))
}));
const RefreshCw = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16m0 5v-5h5"
}));
const Smartphone = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "2",
    width: "14",
    height: "20",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 18h.01"
  }))
}));
const Star = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: "M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"
}));
const Check = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: "M20 6L9 17l-5-5"
}));
const Menu = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: "M4 6h16M4 12h16M4 18h16"
}));
const Users = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"
  }))
}));
const Folder = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"
}));
const FileText = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 2v5h5M9 13h6M9 17h6"
  }))
}));
const Plus = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: "M12 5v14M5 12h14"
}));
const LayoutGrid = p => /*#__PURE__*/React.createElement(Ico, _extends({}, p, {
  d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "7"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "7"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "14",
    width: "7",
    height: "7"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "14",
    width: "7",
    height: "7"
  }))
}));
Object.assign(window, {
  Ico,
  ArrowRight,
  Target,
  Zap,
  MapPin,
  Phone,
  Search,
  BarChart,
  RefreshCw,
  Smartphone,
  Star,
  Check,
  Menu,
  Users,
  Folder,
  FileText,
  Plus,
  LayoutGrid
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/parts.jsx
try { (() => {
/* Shared marketing chrome: Nav, Footer, Sparkline, ControlCenter panel */

function Badge() {
  return /*#__PURE__*/React.createElement("span", {
    className: "badge-404"
  }, /*#__PURE__*/React.createElement("span", {
    className: "b-404"
  }, "404"), /*#__PURE__*/React.createElement("span", {
    className: "b-sep"
  }), /*#__PURE__*/React.createElement("span", {
    className: "b-trade"
  }, "TRADE"), /*#__PURE__*/React.createElement("span", {
    className: "b-sep"
  }), /*#__PURE__*/React.createElement("span", {
    className: "b-os"
  }, "OS"));
}
function Nav({
  page,
  go
}) {
  const links = [["services", "Services"], ["work", "Our work"], ["pricing", "Pricing"], ["about", "About"], ["contact", "Contact"]];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 50,
      background: "rgba(13,10,7,0.95)",
      backdropFilter: "blur(8px)",
      borderBottom: "1px solid var(--color-forge-border)"
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      maxWidth: 1280,
      margin: "0 auto",
      padding: "0 24px",
      height: 64,
      display: "flex",
      alignItems: "center",
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("a", {
    onClick: () => go("home"),
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      cursor: "pointer",
      textDecoration: "none"
    }
  }, /*#__PURE__*/React.createElement(Badge, null), /*#__PURE__*/React.createElement("span", {
    className: "wordmark",
    style: {
      fontSize: 18,
      lineHeight: 1
    }
  }, "Trade", /*#__PURE__*/React.createElement("span", {
    className: "os"
  }, "OS"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 24,
      marginLeft: "auto"
    },
    className: "nav-links"
  }, links.map(([k, label]) => /*#__PURE__*/React.createElement("a", {
    key: k,
    onClick: () => go(k),
    style: {
      fontSize: 14,
      cursor: "pointer",
      color: page === k ? "var(--color-bone)" : "var(--color-forge-muted)",
      transition: "color .15s"
    }
  }, label)), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("contact"),
    className: "btn-primary",
    style: {
      fontSize: 13,
      padding: "8px 16px"
    }
  }, "Get a site"))));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: "var(--color-forge-black)",
      borderTop: "1px solid var(--color-forge-border)",
      padding: "40px 24px 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 24,
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingBottom: 24,
      borderBottom: "1px solid var(--color-forge-border)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, null), /*#__PURE__*/React.createElement("div", {
    className: "wordmark",
    style: {
      fontSize: 24,
      marginTop: 6
    }
  }, "Trade", /*#__PURE__*/React.createElement("span", {
    className: "os"
  }, "OS")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--color-forge-muted)",
      fontSize: 13,
      maxWidth: 300,
      marginTop: 10,
      lineHeight: 1.6
    }
  }, "Web design, SEO & lead generation for trade businesses across the Midwest. Terre Haute, IN.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 48
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mono-label",
    style: {
      marginBottom: 10
    }
  }, "Services"), ["Website design", "Local SEO", "Lead capture", "Google Ads"].map(s => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      fontSize: 13,
      color: "var(--color-forge-muted)",
      marginBottom: 6
    }
  }, s))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mono-label",
    style: {
      marginBottom: 10
    }
  }, "Contact"), ["hello@404tradeos.com", "(812) 562-8504", "404tradeos.com"].map(s => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      fontSize: 13,
      color: "var(--color-forge-muted)",
      marginBottom: 6
    }
  }, s))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 16,
      flexWrap: "wrap",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "status-online"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "var(--color-system-green)"
    },
    className: "led-pulse"
  }), "SYSTEM ONLINE \xB7 UPTIME 99.98% \xB7 BUILD 2026.06"), /*#__PURE__*/React.createElement("span", {
    className: "mono-label"
  }, "\xA9 2026 404 TRADEOS LLC"))));
}
function Sparkline({
  points,
  color = "var(--color-system-green)"
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: "56",
    height: "20",
    viewBox: "0 0 56 20",
    style: {
      opacity: 0.9
    }
  }, /*#__PURE__*/React.createElement("polyline", {
    points: points,
    fill: "none",
    stroke: color,
    strokeWidth: "1.5"
  }));
}
Object.assign(window, {
  Badge,
  Nav,
  Footer,
  Sparkline
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/parts.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/screens.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Services, Pricing, Contact, Work screens */

function PageHead({
  label,
  title,
  sub
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: "120px 24px 40px",
      background: "var(--color-forge-black)",
      borderBottom: "1px solid var(--color-forge-border)",
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid-overlay",
    style: {
      position: "absolute",
      inset: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: "0 auto",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-label"
  }, label), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 44,
      color: "var(--color-bone)",
      margin: "0 0 12px",
      lineHeight: 1.05
    }
  }, title), sub && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--color-forge-muted)",
      fontSize: 17,
      maxWidth: 560,
      lineHeight: 1.6,
      margin: 0
    }
  }, sub)));
}
function Services({
  go
}) {
  const rows = [{
    id: "MOD-01",
    icon: /*#__PURE__*/React.createElement(Smartphone, {
      size: 18
    }),
    title: "Website design",
    body: "Custom, mobile-first sites built to convert visitors into booked jobs.",
    from: "$197/mo",
    time: "2–3 weeks"
  }, {
    id: "MOD-02",
    icon: /*#__PURE__*/React.createElement(Search, {
      size: 18
    }),
    title: "Local SEO",
    body: "Rank on Google Maps and organic search for your trade in your service area.",
    from: "$397/mo",
    time: "Ongoing"
  }, {
    id: "MOD-03",
    icon: /*#__PURE__*/React.createElement(Phone, {
      size: 18
    }),
    title: "Lead generation",
    body: "Smart forms, click-to-call, and booking widgets wired to your CRM.",
    from: "$297/mo",
    time: "1–2 weeks"
  }, {
    id: "MOD-04",
    icon: /*#__PURE__*/React.createElement(BarChart, {
      size: 18
    }),
    title: "Google Ads",
    body: "Paid search that puts you at the top of Google the day we launch.",
    from: "$497/mo",
    time: "3–5 days"
  }, {
    id: "MOD-05",
    icon: /*#__PURE__*/React.createElement(Star, {
      size: 18
    }),
    title: "Review management",
    body: "Automated review requests that grow your rating after every job.",
    from: "$147/mo",
    time: "Ongoing"
  }, {
    id: "MOD-06",
    icon: /*#__PURE__*/React.createElement(RefreshCw, {
      size: 18
    }),
    title: "Ongoing support",
    body: "Hosting, security, updates, and monthly reports — never worry again.",
    from: "$97/mo",
    time: "Ongoing"
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHead, {
    label: "Installed modules",
    title: "Services that get you found",
    sub: "Every module runs independently or as one system. Pick what you need \u2014 we'll tell you honestly what moves the needle for your trade."
  }), /*#__PURE__*/React.createElement("section", {
    className: "section-pad",
    style: {
      background: "var(--color-forge-dark)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "svc-grid",
    style: {
      maxWidth: 1280,
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 16
    }
  }, rows.map(s => /*#__PURE__*/React.createElement(ModCardPriced, _extends({
    key: s.id
  }, s))))));
}
function ModCardPriced({
  icon,
  id,
  title,
  body,
  from,
  time
}) {
  const [h, setH] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      border: `1px solid ${h ? "rgba(184,115,51,0.5)" : "var(--color-forge-border)"}`,
      background: "var(--color-forge-black)",
      borderRadius: 2,
      padding: 20,
      transition: "border-color .2s"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--color-forge-black)",
      background: "linear-gradient(135deg, var(--color-copper), var(--color-copper-dark))"
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    className: "mono-label"
  }, id)), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: "var(--color-bone)",
      margin: "0 0 8px"
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: "var(--color-forge-muted)",
      lineHeight: 1.6,
      margin: "0 0 16px"
    }
  }, body), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      paddingTop: 12,
      borderTop: "1px solid var(--color-forge-border)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      color: "var(--color-forge-rust)"
    }
  }, "from"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "var(--color-copper)"
    }
  }, from)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      color: "var(--color-forge-rust)"
    }
  }, "timeline"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--color-copper-light)"
    }
  }, time))));
}
function Pricing({
  go
}) {
  const tiers = [{
    name: "Launch",
    price: "$197",
    setup: "$299 setup",
    tag: "Get online",
    feats: ["5-page custom website", "Mobile-first design", "Google Business setup", "Contact forms + click-to-call", "SSL, hosting & security"],
    featured: false
  }, {
    name: "Rank",
    price: "$397",
    setup: "$699 setup",
    tag: "Get found",
    feats: ["Everything in Launch", "Local SEO optimization", "Google Maps ranking", "Monthly ranking reports", "Review request automation", "Up to 10 pages"],
    featured: true
  }, {
    name: "Dominate",
    price: "$897",
    setup: "$1,299 setup",
    tag: "Own your market",
    feats: ["Everything in Rank", "Google Ads management", "Lead tracking dashboard", "Call recording & tracking", "Priority support", "Unlimited pages"],
    featured: false
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHead, {
    label: "Pricing",
    title: "Straight pricing. No surprises.",
    sub: "Monthly plans, cancel anytime. Setup covers design, copy, and launch. No contracts \u2014 we earn the renewal every month."
  }), /*#__PURE__*/React.createElement("section", {
    className: "section-pad",
    style: {
      background: "var(--color-forge-dark)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "price-grid",
    style: {
      maxWidth: 1080,
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 16,
      alignItems: "start"
    }
  }, tiers.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.name,
    style: {
      border: `1px solid ${t.featured ? "var(--color-copper)" : "var(--color-forge-border)"}`,
      background: "var(--color-forge-black)",
      borderRadius: 2,
      padding: 28,
      position: "relative"
    }
  }, t.featured && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: -11,
      left: 28,
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "var(--color-forge-black)",
      background: "var(--color-copper)",
      padding: "3px 10px",
      borderRadius: 3
    }
  }, "Most popular"), /*#__PURE__*/React.createElement("div", {
    className: "mono-label",
    style: {
      marginBottom: 6
    }
  }, t.tag), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 24,
      color: "var(--color-bone)",
      margin: "0 0 12px"
    }
  }, t.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 6,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 40,
      fontWeight: 500,
      color: "var(--color-bone)",
      fontFamily: "var(--font-display)"
    }
  }, t.price), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-forge-rust)",
      fontSize: 14
    }
  }, "/mo")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontFamily: "var(--font-mono)",
      color: "var(--color-forge-rust)",
      marginBottom: 22
    }
  }, "+ ", t.setup), /*#__PURE__*/React.createElement("a", {
    onClick: () => go("contact"),
    className: t.featured ? "btn-primary" : "btn-outline",
    style: {
      width: "100%",
      justifyContent: "center",
      marginBottom: 22
    }
  }, "Get started"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, t.feats.map(f => /*#__PURE__*/React.createElement("div", {
    key: f,
    style: {
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      fontSize: 13,
      color: "var(--color-forge-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-copper)",
      marginTop: 1,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Check, {
    size: 14
  })), f))))))));
}
function Contact() {
  const [sent, setSent] = useState(false);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHead, {
    label: "Get a quote",
    title: "Let's get you found.",
    sub: "Tell us about your trade and service area. We'll send a straight-up quote within one business day \u2014 no pressure, no sales script."
  }), /*#__PURE__*/React.createElement("section", {
    className: "section-pad",
    style: {
      background: "var(--color-forge-dark)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 560,
      margin: "0 auto"
    }
  }, sent ? /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid rgba(0,200,150,0.3)",
      background: "rgba(0,200,150,0.08)",
      borderRadius: 2,
      padding: 32,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "status-online",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "var(--color-system-green)"
    },
    className: "led-pulse"
  }), "REQUEST RECEIVED"), /*#__PURE__*/React.createElement("h3", {
    style: {
      color: "var(--color-bone)",
      fontSize: 22,
      margin: "8px 0"
    }
  }, "Thanks \u2014 we'll be in touch."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--color-forge-muted)",
      fontSize: 14
    }
  }, "Expect a real reply from Billy within one business day.")) : /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      setSent(true);
    },
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, [["Name", "text", "Your name"], ["Business", "text", "e.g. Showalter Plumbing"], ["Email", "email", "you@business.com"], ["Phone", "tel", "(812) 555-0100"]].map(([l, ty, ph]) => /*#__PURE__*/React.createElement("label", {
    key: l,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono-label"
  }, l), /*#__PURE__*/React.createElement("input", {
    type: ty,
    placeholder: ph,
    required: true,
    style: inputStyle
  }))), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono-label"
  }, "What do you need?"), /*#__PURE__*/React.createElement("textarea", {
    rows: 4,
    placeholder: "New website, better ranking, more leads\u2026",
    style: {
      ...inputStyle,
      resize: "vertical"
    }
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "btn-primary",
    style: {
      justifyContent: "center",
      border: "none"
    }
  }, "Send request ", /*#__PURE__*/React.createElement(ArrowRight, {
    size: 16
  }))))));
}
const inputStyle = {
  background: "var(--color-forge-black)",
  border: "1px solid var(--color-forge-border)",
  borderRadius: 3,
  padding: "10px 12px",
  color: "var(--color-bone)",
  fontSize: 14,
  fontFamily: "var(--font-sans)",
  outline: "none"
};
function Work() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHead, {
    label: "Case study",
    title: "From 404 to found",
    sub: "Lucas Construction \u2014 a general contractor in Terre Haute, IN \u2014 had no site and no presence. Here's what changed."
  }), /*#__PURE__*/React.createElement("section", {
    className: "section-pad",
    style: {
      background: "var(--color-forge-dark)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1080,
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    },
    className: "work-grid"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--color-forge-border)",
      background: "var(--color-forge-black)",
      borderRadius: 2,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 16px",
      borderBottom: "1px solid var(--color-forge-border)",
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono-label"
  }, "Before"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--color-error-red)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "var(--color-error-red)"
    }
  }), "ERROR 404")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24
    }
  }, [["Google ranking", "Not ranked"], ["Monthly leads", "3–4"], ["Website", "None"], ["Reviews", "2"]].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: "flex",
      justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: "1px solid var(--color-forge-border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-forge-rust)",
      fontSize: 13
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-forge-muted)",
      fontSize: 13
    }
  }, v))))), /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid rgba(184,115,51,0.5)",
      background: "var(--color-forge-black)",
      borderRadius: 2,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 16px",
      borderBottom: "1px solid var(--color-forge-border)",
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono-label"
  }, "After \u2014 90 days"), /*#__PURE__*/React.createElement("span", {
    className: "status-online"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "var(--color-system-green)"
    },
    className: "led-pulse"
  }), "LIVE")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24
    }
  }, [["Google ranking", "#1–3 local"], ["Monthly leads", "28+"], ["Website", "Live in 2 wks"], ["Reviews", "41 ★ 4.9"]].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: "flex",
      justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: "1px solid var(--color-forge-border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-forge-rust)",
      fontSize: 13
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-copper-light)",
      fontSize: 13,
      fontWeight: 600
    }
  }, v))))))));
}
function About() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHead, {
    label: "About",
    title: "Built by a tradesman.",
    sub: "404 TradeOS is run by Billy Showalter \u2014 a licensed plumber (IN/IL), OSHA 30 certified, based in Terre Haute. We build for the trades because we came from the trades."
  }), /*#__PURE__*/React.createElement("section", {
    className: "section-pad",
    style: {
      background: "var(--color-forge-dark)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: "0 auto",
      color: "var(--color-forge-muted)",
      fontSize: 16,
      lineHeight: 1.75
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 0
    }
  }, "We're not a coastal agency that read a blog post about your industry. We've been on the truck, on the roof, and under the sink. We know what a homeowner types into Google when their water heater fails \u2014 and we make sure your business is the one they find."), /*#__PURE__*/React.createElement("p", null, "No jargon. No lock-in contracts. We track your rankings monthly and tell you exactly what moved and why. If it's not working, we say so."))));
}
Object.assign(window, {
  Services,
  Pricing,
  Contact,
  Work,
  About
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge404 = __ds_scope.Badge404;

__ds_ns.Wordmark = __ds_scope.Wordmark;

__ds_ns.CornerBrackets = __ds_scope.CornerBrackets;

__ds_ns.OSModuleCard = __ds_scope.OSModuleCard;

__ds_ns.TerminalFrame = __ds_scope.TerminalFrame;

__ds_ns.BlinkingCursor = __ds_scope.BlinkingCursor;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.SecLabel = __ds_scope.SecLabel;

__ds_ns.StatusLED = __ds_scope.StatusLED;

__ds_ns.StatusPill = __ds_scope.StatusPill;

})();
