import React from "react";

/**
 * CNC-reticle corner ticks for any position:relative parent. Purely decorative.
 * @param {number} size  length of each bracket arm in px
 */
export function CornerBrackets({ size = 14, color = "var(--color-copper)", className = "", style }) {
  const arm = { position: "absolute", stroke: color, strokeWidth: 1.25, fill: "none" };
  const s = size;
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", ...style }}
    >
      <svg style={{ ...arm, top: 6, left: 6 }} width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <path d={`M0 ${s} L0 0 L${s} 0`} />
      </svg>
      <svg style={{ ...arm, top: 6, right: 6 }} width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <path d={`M0 0 L${s} 0 L${s} ${s}`} />
      </svg>
      <svg style={{ ...arm, bottom: 6, left: 6 }} width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <path d={`M0 0 L0 ${s} L${s} ${s}`} />
      </svg>
      <svg style={{ ...arm, bottom: 6, right: 6 }} width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <path d={`M${s} 0 L${s} ${s} L0 ${s}`} />
      </svg>
    </div>
  );
}
