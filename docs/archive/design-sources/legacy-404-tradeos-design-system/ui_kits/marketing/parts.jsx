/* Shared marketing chrome: Nav, Footer, Sparkline, ControlCenter panel */

function Badge() {
  return (
    <span className="badge-404">
      <span className="b-404">404</span><span className="b-sep" />
      <span className="b-trade">TRADE</span><span className="b-sep" />
      <span className="b-os">OS</span>
    </span>
  );
}

function Nav({ page, go }) {
  const links = [["services","Services"],["work","Our work"],["pricing","Pricing"],["about","About"],["contact","Contact"]];
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(13,10,7,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--color-forge-border)" }}>
      <nav style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", gap: 32 }}>
        <a onClick={() => go("home")} style={{ display: "flex", flexDirection: "column", gap: 2, cursor: "pointer", textDecoration: "none" }}>
          <Badge />
          <span className="wordmark" style={{ fontSize: 18, lineHeight: 1 }}>Trade<span className="os">OS</span></span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginLeft: "auto" }} className="nav-links">
          {links.map(([k, label]) => (
            <a key={k} onClick={() => go(k)} style={{ fontSize: 14, cursor: "pointer", color: page === k ? "var(--color-bone)" : "var(--color-forge-muted)", transition: "color .15s" }}>{label}</a>
          ))}
          <a onClick={() => go("contact")} className="btn-primary" style={{ fontSize: 13, padding: "8px 16px" }}>Get a site</a>
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer style={{ background: "var(--color-forge-black)", borderTop: "1px solid var(--color-forge-border)", padding: "40px 24px 28px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 24, borderBottom: "1px solid var(--color-forge-border)" }}>
          <div>
            <Badge />
            <div className="wordmark" style={{ fontSize: 24, marginTop: 6 }}>Trade<span className="os">OS</span></div>
            <p style={{ color: "var(--color-forge-muted)", fontSize: 13, maxWidth: 300, marginTop: 10, lineHeight: 1.6 }}>Web design, SEO & lead generation for trade businesses across the Midwest. Terre Haute, IN.</p>
          </div>
          <div style={{ display: "flex", gap: 48 }}>
            <div>
              <div className="mono-label" style={{ marginBottom: 10 }}>Services</div>
              {["Website design","Local SEO","Lead capture","Google Ads"].map(s => <div key={s} style={{ fontSize: 13, color: "var(--color-forge-muted)", marginBottom: 6 }}>{s}</div>)}
            </div>
            <div>
              <div className="mono-label" style={{ marginBottom: 10 }}>Contact</div>
              {["hello@404tradeos.com","(812) 562-8504","404tradeos.com"].map(s => <div key={s} style={{ fontSize: 13, color: "var(--color-forge-muted)", marginBottom: 6 }}>{s}</div>)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, flexWrap: "wrap", gap: 10 }}>
          <span className="status-online"><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-system-green)" }} className="led-pulse" />SYSTEM ONLINE · UPTIME 99.98% · BUILD 2026.06</span>
          <span className="mono-label">© 2026 404 TRADEOS LLC</span>
        </div>
      </div>
    </footer>
  );
}

function Sparkline({ points, color = "var(--color-system-green)" }) {
  return <svg width="56" height="20" viewBox="0 0 56 20" style={{ opacity: 0.9 }}><polyline points={points} fill="none" stroke={color} strokeWidth="1.5" /></svg>;
}

Object.assign(window, { Badge, Nav, Footer, Sparkline });
