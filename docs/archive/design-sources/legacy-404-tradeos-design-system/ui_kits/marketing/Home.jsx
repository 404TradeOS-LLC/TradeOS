/* Marketing screens: Home, Services, Pricing, Contact */
const { useState } = React;

function ControlCenter() {
  const metrics = [
    { k: "Leads this month", v: "47", delta: "↑ 18%", points: "0,16 8,15 16,12 24,13 32,9 40,7 48,3" },
    { k: "Calls tracked", v: "22", delta: "↑ 27%", points: "0,17 8,14 16,15 24,11 32,10 40,6 48,4" },
    { k: "Quote requests", v: "13", delta: "↑ 8%", points: "0,12 8,13 16,10 24,11 32,8 40,9 48,5" },
    { k: "Reviews gained", v: "+8", delta: "↑ 33%", points: "0,18 8,16 16,13 24,10 32,8 40,5 48,2" },
  ];
  return (
    <div className="crt-hover" style={{ border: "1px solid var(--color-forge-border)", background: "rgba(30,22,16,0.95)", backdropFilter: "blur(6px)", borderRadius: 2, overflow: "hidden", boxShadow: "var(--shadow-panel)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--color-forge-border)", background: "rgba(13,10,7,0.9)" }}>
        <span className="mono-label">TradeOS <span style={{ color: "var(--color-copper)" }}>Control Center</span></span>
        <span className="status-online"><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-system-green)" }} className="led-pulse" />Status: Online</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderBottom: "1px solid var(--color-forge-border)" }}>
        {metrics.map((m, i) => (
          <div key={m.k} style={{ padding: 12, borderRight: i < 3 ? "1px solid var(--color-forge-border)" : "none" }}>
            <div className="mono-label" style={{ marginBottom: 6, fontSize: 9 }}>{m.k}</div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: "var(--color-bone)", lineHeight: 1 }}>{m.v}</span>
              <Sparkline points={m.points} />
            </div>
            <div style={{ fontSize: 10, color: "var(--color-system-green)", marginTop: 4 }}>{m.delta}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: 12 }}>
        <div className="mono-label" style={{ marginBottom: 8, fontSize: 9 }}>Recent activity</div>
        {[["New lead from website","2m ago"],["Quote request submitted","15m ago"],["Google review received","32m ago"],["Phone call tracked","42m ago"]].map(([l, t]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, marginBottom: 5 }}>
            <span style={{ color: "var(--color-forge-muted)" }}>{l}</span>
            <span style={{ color: "var(--color-forge-rust)" }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Home({ go }) {
  const heroFeatures = [
    { icon: <Target size={16} />, title: "Built for trades", body: "We understand your business." },
    { icon: <Zap size={16} />, title: "Results that matter", body: "More calls. More leads. More jobs." },
    { icon: <MapPin size={16} />, title: "Local. Reliable. Real.", body: "Terre Haute, IN. Serving the Midwest." },
  ];
  const services = [
    { id: "MOD-01", icon: <Smartphone size={18} />, title: "Website design", body: "Custom sites built for trade businesses. Fast, mobile-first, designed to convert visitors into booked jobs." },
    { id: "MOD-02", icon: <Search size={18} />, title: "Local SEO", body: "Get found on Google Maps and organic search when customers search for your trade in your area." },
    { id: "MOD-03", icon: <Phone size={18} />, title: "Lead capture", body: "Smart forms, click-to-call, and booking widgets that turn visitors into paying customers." },
    { id: "MOD-04", icon: <BarChart size={18} />, title: "Google Ads", body: "Paid search campaigns that put you at the top of Google the same day we launch." },
    { id: "MOD-05", icon: <Star size={18} />, title: "Review management", body: "Automated review requests that grow your Google rating on autopilot after every job." },
    { id: "MOD-06", icon: <RefreshCw size={18} />, title: "Ongoing support", body: "Monthly hosting, security, updates, and reports so you never worry about your site again." },
  ];
  const process = [
    { title: "Discovery call", body: "We learn your trade, service area, and competitors in 30 minutes.", time: "Day 1" },
    { title: "Design & build", body: "Custom design, trade-specific copy, full SEO setup. You approve before launch.", time: "Week 1–2" },
    { title: "Review & revise", body: "Two rounds of revisions included. We don't launch until you're satisfied.", time: "Week 2–3" },
    { title: "Launch & rank", body: "Domain, hosting, SSL, Google Business — all handled. Live in 30 days.", time: "Week 2–4" },
  ];
  return (
    <>
      {/* HERO */}
      <section style={{ position: "relative", minHeight: "88vh", display: "flex", alignItems: "center", overflow: "hidden", background: "var(--color-forge-black)" }}>
        <img src="../../assets/images/hero/contractor-truck-jobsite.jpg" alt="Contractor at a jobsite" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(90deg, rgba(13,10,7,0.97) 0%, rgba(13,10,7,0.88) 28%, rgba(13,10,7,0.45) 52%, rgba(13,10,7,0.15) 70%, transparent 85%), linear-gradient(180deg, transparent 55%, rgba(13,10,7,0.9) 100%)", zIndex: 2 }} />
        <HeroBackground />
        <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%", padding: "0 24px", position: "relative", zIndex: 10 }}>
          <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr minmax(0,540px)", gap: 40, alignItems: "end" }}>
            <div>
              <div className="mono-label fade-up" style={{ marginBottom: 16 }}>Websites. SEO. Leads. Growth.</div>
              <h1 className="fade-up fade-up-delay-1" style={{ fontSize: 58, color: "var(--color-bone)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 20px", textTransform: "uppercase", textWrap: "balance" }}>
                Stop being a 404.<br /><span style={{ color: "var(--color-copper)" }}>Start getting found.</span>
              </h1>
              <p className="fade-up fade-up-delay-2" style={{ fontSize: 18, color: "var(--color-forge-muted)", lineHeight: 1.6, margin: "0 0 32px", maxWidth: 480 }}>
                High-performance websites and marketing systems that get trade businesses more calls, more leads, and more jobs.
              </p>
              <div className="fade-up fade-up-delay-3" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 40 }}>
                <a onClick={() => go("contact")} className="btn-primary">Get a quote <Target size={16} /></a>
                <a onClick={() => go("work")} className="btn-outline">See our work <ArrowRight size={16} /></a>
              </div>
              <div className="fade-up fade-up-delay-3 hero-feats" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, maxWidth: 560 }}>
                {heroFeatures.map(f => (
                  <div key={f.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--color-copper)", marginTop: 2, flexShrink: 0 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-bone)" }}>{f.title}</div>
                      <div style={{ fontSize: 12, color: "var(--color-forge-muted)", lineHeight: 1.4 }}>{f.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="hero-panel fade-in-right"><ControlCenter /></div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section style={{ padding: "40px 24px", borderBottom: "1px solid var(--color-forge-border)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
          <div className="mono-label" style={{ marginBottom: 18 }}>Trusted by trade businesses across the Midwest</div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
            {["Plumbers","Electricians","HVAC","Roofers","Contractors"].map(t => (
              <span key={t} style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-forge-muted)", border: "1px solid var(--color-forge-border)", borderRadius: 999, padding: "6px 16px" }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="section-pad" style={{ background: "var(--color-forge-dark)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 12 }}>
            <div>
              <span className="sec-label">Installed modules</span>
              <h2 style={{ fontSize: 36, color: "var(--color-bone)", margin: 0, lineHeight: 1.1 }}>Everything your trade<br />business needs online</h2>
            </div>
            <a onClick={() => go("services")} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, color: "var(--color-copper)", cursor: "pointer", fontFamily: "var(--font-mono)" }}>View all <ArrowRight size={14} /></a>
          </div>
          <div className="svc-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {services.map(s => <OSModuleCard key={s.id} {...s} onClick={() => go("services")} />)}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="section-pad" style={{ background: "var(--color-forge-black)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <span className="sec-label">How it works</span>
          <h2 style={{ fontSize: 36, color: "var(--color-bone)", margin: "0 0 40px", lineHeight: 1.1 }}>Done for you. Built right.<br />No shortcuts.</h2>
          <div className="proc-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            {process.map((p, i) => (
              <div key={p.title} style={{ border: "1px solid var(--color-forge-border)", background: "var(--color-forge-dark)", borderRadius: 2, padding: 20 }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: "rgba(184,115,51,0.3)", fontFamily: "var(--font-display)", marginBottom: 14 }}>{String(i + 1).padStart(2, "0")}</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-bone)", margin: "0 0 8px" }}>{p.title}</h3>
                <p style={{ fontSize: 13, color: "var(--color-forge-muted)", lineHeight: 1.6, margin: "0 0 14px" }}>{p.body}</p>
                <span style={{ display: "inline-block", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-system-green)", background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 999, padding: "3px 12px" }}>{p.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="section-pad" style={{ background: "var(--color-forge-dark)", borderTop: "1px solid var(--color-forge-border)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <span className="sec-label" style={{ textAlign: "center" }}>Client results</span>
          <div style={{ display: "flex", justifyContent: "center", gap: 2, margin: "0 0 16px" }}>
            {[...Array(5)].map((_, i) => <span key={i} style={{ color: "var(--color-copper)" }}><Star size={16} fill="var(--color-copper)" /></span>)}
          </div>
          <blockquote style={{ fontSize: 24, color: "var(--color-bone)", lineHeight: 1.4, fontWeight: 500, margin: "0 0 16px" }}>
            "Within 3 weeks of launching I was ranking #1 for plumber in my city. Phones haven't stopped ringing since."
          </blockquote>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--color-forge-rust)" }}>Jake S. — Plumber, Indianapolis, IN</div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-pad" style={{ background: "var(--color-forge-black)", textAlign: "center" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}><Badge /></div>
          <h2 style={{ fontSize: 38, color: "var(--color-bone)", margin: "0 0 16px", lineHeight: 1.1 }}>Stop being a <span style={{ color: "var(--color-copper)" }}>404</span>.<br />Start getting found.</h2>
          <p style={{ color: "var(--color-forge-muted)", lineHeight: 1.6, margin: "0 0 32px" }}>Free 30-minute discovery call. No contracts, no pressure. Just a website that works as hard as you do.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a onClick={() => go("contact")} className="btn-primary">Book a free call <ArrowRight size={16} /></a>
            <a onClick={() => go("pricing")} className="btn-ghost">See pricing</a>
          </div>
        </div>
      </section>
    </>
  );
}

/* OSModuleCard — local copy (mirrors the DS component) */
function OSModuleCard({ icon, id, title, body, onClick }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} className="crt-hover"
      style={{ position: "relative", cursor: "pointer", border: `1px solid ${h ? "rgba(184,115,51,0.5)" : "var(--color-forge-border)"}`, background: "var(--color-forge-dark)", borderRadius: 2, padding: 20, transition: "border-color .2s", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-forge-black)", background: "linear-gradient(135deg, var(--color-copper), var(--color-copper-dark))" }}>{icon}</div>
        <span className="mono-label">{id}</span>
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: h ? "var(--color-copper-light)" : "var(--color-bone)", margin: "0 0 8px", transition: "color .2s" }}>{title}</h3>
      <p style={{ fontSize: 14, color: "var(--color-forge-muted)", lineHeight: 1.6, margin: "0 0 16px" }}>{body}</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--color-forge-border)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", color: "var(--color-system-green)" }}>
          <span className="led-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-system-green)", boxShadow: "0 0 6px var(--color-system-green)" }} />RUNNING
        </span>
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-forge-rust)" }}>v2.4</span>
      </div>
    </div>
  );
}

Object.assign(window, { Home });
