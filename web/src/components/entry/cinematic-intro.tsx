"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { MetalLogo } from "./metal-logo";
export function Schematics({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`schematics ${className}`}
      viewBox="0 0 1440 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g fill="none">
        {Array.from({ length: 10 }, (_, i) => {
          const y = 150 + i * 78;
          return (
            <path
              key={i}
              pathLength="1"
              style={{ "--line": i } as CSSProperties}
              d={`M -100 ${y} H ${140 + i * 14} L ${230 + i * 14} ${y + 90} H 450 M 1540 ${y} H ${1300 - i * 14} L ${1210 - i * 14} ${y + 90} H 990`}
            />
          );
        })}
        <path
          className="circuit-spine"
          d="M30 40H350L410 100V280M1410 960H1090L1030 900V720M30 960H280L340 900V760M1410 40H1160L1100 100V240"
        />
        {[
          [410, 280],
          [1030, 720],
          [340, 760],
          [1100, 240],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="4" />
        ))}
      </g>
    </svg>
  );
}
export function CinematicIntro({
  duration,
  onComplete,
}: {
  duration: number;
  onComplete: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    skip = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false,
      dispose: (() => void) | undefined;
    const start = performance.now();
    const timeout = window.setTimeout(onComplete, duration);
    const unavailable = () => setReady(false);
    node.addEventListener("cinema-unavailable", unavailable);
    skip.current?.focus({ preventScroll: true });
    import("./cinema")
      .then(({ createCinema }) => {
        if (cancelled || performance.now() - start > duration * 0.68) return;
        try {
          dispose = createCinema(node, () => ({ start, duration }));
          setReady(true);
        } catch {
          /* Vector fallback remains visible if the GPU is unavailable. */
        }
      })
      .catch(() => {
        /* Slow/offline chunk loading never delays the exit. */
      });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onComplete();
    };
    document.addEventListener("keydown", key);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      dispose?.();
      document.removeEventListener("keydown", key);
      node.removeEventListener("cinema-unavailable", unavailable);
    };
  }, [duration, onComplete]);
  return (
    <section
      className={`intro-film ${ready ? "has-webgl" : "vector-fallback"}`}
      style={{ "--intro-time": `${duration}ms` } as CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label="TradeOS introduction"
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          skip.current?.focus();
        }
      }}
    >
      <div ref={host} className="film-canvas" aria-hidden="true" />
      <div className="film-fallback" aria-hidden="true">
        <Schematics />
        <div className="film-logo">
          <MetalLogo variant="mark" className="film-emblem" />
          <MetalLogo variant="logo" className="film-word" />
        </div>
      </div>
      <div className="film-vignette" aria-hidden="true" />
      <div className="film-corner film-top" aria-hidden="true">
        <span>TRADEOS</span>
        <span>404 TRADEOS LLC</span>
      </div>
      <div className="film-corner film-bottom">
        <span aria-hidden="true">404 TRADEOS LLC</span>
        <button
          ref={skip}
          type="button"
          className="skip-film"
          onClick={onComplete}
        >
          Skip intro <ArrowRight size={15} />
        </button>
      </div>
      <div className="film-timeline" aria-hidden="true">
        <span />
      </div>
    </section>
  );
}
