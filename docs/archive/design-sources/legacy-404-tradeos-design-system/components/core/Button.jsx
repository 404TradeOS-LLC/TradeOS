import React from "react";

/**
 * Brand button. Three variants map to the production .btn-primary / .btn-outline / .btn-ghost.
 * Copper is the only fill; never introduce another accent.
 */
export function Button({
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
    transition: "background .15s, border-color .15s, color .15s, transform .08s, filter .08s",
  };
  const variants = {
    primary: {
      background: "var(--color-copper)",
      color: "var(--color-forge-black)",
      fontWeight: 600,
      border: "none",
    },
    outline: {
      background: "transparent",
      color: "var(--color-copper)",
      fontWeight: 500,
      border: "1.5px solid var(--color-copper)",
    },
    ghost: {
      background: "transparent",
      color: "var(--color-forge-muted)",
      fontWeight: 500,
      border: "1px solid var(--color-forge-border)",
    },
  };
  return (
    <Tag
      className={className}
      style={{ ...shared, ...(variants[variant] || variants.primary), ...style }}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </Tag>
  );
}
