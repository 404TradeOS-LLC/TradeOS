import React, { useId } from "react";
import { MARK_PATHS, LOGO_PATHS } from "./logo-paths";
export function MetalLogo({
  variant = "mark",
  className = "",
}: {
  variant?: "mark" | "logo";
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const paths = variant === "mark" ? MARK_PATHS : LOGO_PATHS;
  return (
    <svg
      className={"metal-logo " + className}
      viewBox={variant === "mark" ? "0 0 283 284" : "0 0 525 145"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={"copper-" + id} x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#7c432b" />
          <stop offset=".18" stopColor="#c58b66" />
          <stop offset=".32" stopColor="#f0c6a0" />
          <stop offset=".37" stopColor="#d19a73" />
          <stop offset=".58" stopColor="#a46643" />
          <stop offset=".8" stopColor="#e6b38c" />
          <stop offset="1" stopColor="#6d3a23" />
        </linearGradient>
        <linearGradient id={"bevel-" + id} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffe0b7" />
          <stop offset=".5" stopColor="#c68b61" />
          <stop offset="1" stopColor="#4c281c" />
        </linearGradient>
      </defs>
      {[8, 6, 4, 2].map((offset) => (
        <g
          className="metal-depth"
          key={offset}
          transform={`translate(${offset * 0.65} ${offset})`}
          fill="#542d1d"
        >
          {paths.map((p, i) => (
            <path key={i} pathLength="1" {...p} />
          ))}
        </g>
      ))}
      <g
        className="metal-face"
        fill={`url(#copper-${id})`}
        stroke={`url(#bevel-${id})`}
        strokeWidth={variant === "mark" ? 1.1 : 5}
        strokeLinejoin="round"
      >
        {paths.map((p, i) => (
          <path key={i} pathLength="1" {...p} />
        ))}
      </g>
    </svg>
  );
}
