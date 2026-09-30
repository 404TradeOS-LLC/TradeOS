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
    let raf = null, x = -100, y = -100;
    const apply = () => { raf = null;
      if (dotRef.current) dotRef.current.style.transform = `translate3d(${x}px,${y}px,0)`;
      if (ringRef.current) ringRef.current.style.transform = `translate3d(${x}px,${y}px,0)`;
    };
    const queue = () => { if (raf === null) raf = requestAnimationFrame(apply); };
    const move = e => { x = e.clientX; y = e.clientY; queue(); };
    const over = e => { const it = e.target.closest("a,button,input,select,textarea,[role='button']");
      ringRef.current?.classList.toggle("cursor-ring-active", !!it); };
    const down = () => ringRef.current?.classList.add("cursor-ring-pressed");
    const up = () => ringRef.current?.classList.remove("cursor-ring-pressed");
    addEventListener("mousemove", move, { passive: true });
    addEventListener("mouseover", over, { passive: true });
    addEventListener("mousedown", down, { passive: true });
    addEventListener("mouseup", up, { passive: true });
    return () => { root.classList.remove("custom-cursor-active");
      removeEventListener("mousemove", move); removeEventListener("mouseover", over);
      removeEventListener("mousedown", down); removeEventListener("mouseup", up);
      if (raf !== null) cancelAnimationFrame(raf); };
  }, []);
  return (
    <div aria-hidden="true">
      <div ref={dotRef} className="custom-cursor-dot" />
      <div ref={ringRef} className="custom-cursor-ring">
        <span className="custom-cursor-tick custom-cursor-tick-t" />
        <span className="custom-cursor-tick custom-cursor-tick-r" />
        <span className="custom-cursor-tick custom-cursor-tick-b" />
        <span className="custom-cursor-tick custom-cursor-tick-l" />
      </div>
    </div>
  );
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
    let raf = null, x = 0, y = 0, nx = 0, ny = 0;
    const apply = () => { raf = null;
      el.style.setProperty("--mx", `${x}px`); el.style.setProperty("--my", `${y}px`);
      if (coord.current) coord.current.textContent = `X:${nx.toFixed(3)} Y:${ny.toFixed(3)}`;
    };
    const move = e => { const r = el.getBoundingClientRect();
      x = e.clientX - r.left; y = e.clientY - r.top; nx = x / r.width; ny = y / r.height;
      if (raf === null) raf = requestAnimationFrame(apply); };
    addEventListener("mousemove", move, { passive: true });
    return () => { removeEventListener("mousemove", move); if (raf !== null) cancelAnimationFrame(raf); };
  }, []);
  const particles = Array.from({ length: 22 }, (_, i) => ({
    left: (i * 137.508) % 100, top: (i * 53) % 100, size: 2 + (i % 4),
    dur: 8 + (i % 6) * 2, delay: -((i % 8) * 0.9),
  }));
  return (
    <div ref={box} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", userSelect: "none", overflow: "hidden" }}>
      <div className="grid-overlay" style={{ position: "absolute", inset: 0 }} />
      <div className="scanline-overlay" style={{ position: "absolute", inset: 0 }} />
      <div className="hero-crosshair-h" />
      <div className="hero-crosshair-v" />
      <div className="hero-scan-ring" />
      <span ref={coord} className="hero-coord-readout" />
      {particles.map((p, i) => (
        <span key={i} style={{ position: "absolute", left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, borderRadius: 1, background: "var(--color-copper-light)", opacity: 0.35 }} />
      ))}
    </div>
  );
}

Object.assign(window, { CustomCursor, HeroBackground });
