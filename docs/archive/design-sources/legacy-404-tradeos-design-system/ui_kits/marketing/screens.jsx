/* Services, Pricing, Contact, Work screens */

function PageHead({ label, title, sub }) {
  return (
    <section style={{ padding: "120px 24px 40px", background: "var(--color-forge-black)", borderBottom: "1px solid var(--color-forge-border)", position: "relative", overflow: "hidden" }}>
      <div className="grid-overlay" style={{ position: "absolute", inset: 0 }} />
      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
        <span className="sec-label">{label}</span>
        <h1 style={{ fontSize: 44, color: "var(--color-bone)", margin: "0 0 12px", lineHeight: 1.05 }}>{title}</h1>
        {sub && <p style={{ color: "var(--color-forge-muted)", fontSize: 17, maxWidth: 560, lineHeight: 1.6, margin: 0 }}>{sub}</p>}
      </div>
    </section>
  );
}

function Services({ go }) {
  const rows = [
    { id: "MOD-01", icon: <Smartphone size={18} />, title: "Website design", body: "Custom, mobile-first sites built to convert visitors into booked jobs.", from: "$197/mo", time: "2–3 weeks" },
    { id: "MOD-02", icon: <Search size={18} />, title: "Local SEO", body: "Rank on Google Maps and organic search for your trade in your service area.", from: "$397/mo", time: "Ongoing" },
    { id: "MOD-03", icon: <Phone size={18} />, title: "Lead generation", body: "Smart forms, click-to-call, and booking widgets wired to your CRM.", from: "$297/mo", time: "1–2 weeks" },
    { id: "MOD-04", icon: <BarChart size={18} />, title: "Google Ads", body: "Paid search that puts you at the top of Google the day we launch.", from: "$497/mo", time: "3–5 days" },
    { id: "MOD-05", icon: <Star size={18} />, title: "Review management", body: "Automated review requests that grow your rating after every job.", from: "$147/mo", time: "Ongoing" },
    { id: "MOD-06", icon: <RefreshCw size={18} />, title: "Ongoing support", body: "Hosting, security, updates, and monthly reports — never worry again.", from: "$97/mo", time: "Ongoing" },
  ];
  return (
    <>
      <PageHead label="Installed modules" title="Services that get you found" sub="Every module runs independently or as one system. Pick what you need — we'll tell you honestly what moves the needle for your trade." />
      <section className="section-pad" style={{ background: "var(--color-forge-dark)" }}>
        <div className="svc-grid" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {rows.map(s => <ModCardPriced key={s.id} {...s} />)}
        </div>
      </section>
    </>
  );
}

function ModCardPriced({ icon, id, title, body, from, time }) {
  const [h, setH] = useState(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ border: `1px solid ${h ? "rgba(184,115,51,0.5)" : "var(--color-forge-border)"}`, background: "var(--color-forge-black)", borderRadius: 2, padding: 20, transition: "border-color .2s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-forge-black)", background: "linear-gradient(135deg, var(--color-copper), var(--color-copper-dark))" }}>{icon}</div>
        <span className="mono-label">{id}</span>
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-bone)", margin: "0 0 8px" }}>{title}</h3>
      <p style={{ fontSize: 14, color: "var(--color-forge-muted)", lineHeight: 1.6, margin: "0 0 16px" }}>{body}</p>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--color-forge-border)" }}>
        <div><div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-forge-rust)" }}>from</div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-copper)" }}>{from}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-forge-rust)" }}>timeline</div><div style={{ fontSize: 14, color: "var(--color-copper-light)" }}>{time}</div></div>
      </div>
    </div>
  );
}

function Pricing({ go }) {
  const tiers = [
    { name: "Launch", price: "$197", setup: "$299 setup", tag: "Get online", feats: ["5-page custom website", "Mobile-first design", "Google Business setup", "Contact forms + click-to-call", "SSL, hosting & security"], featured: false },
    { name: "Rank", price: "$397", setup: "$699 setup", tag: "Get found", feats: ["Everything in Launch", "Local SEO optimization", "Google Maps ranking", "Monthly ranking reports", "Review request automation", "Up to 10 pages"], featured: true },
    { name: "Dominate", price: "$897", setup: "$1,299 setup", tag: "Own your market", feats: ["Everything in Rank", "Google Ads management", "Lead tracking dashboard", "Call recording & tracking", "Priority support", "Unlimited pages"], featured: false },
  ];
  return (
    <>
      <PageHead label="Pricing" title="Straight pricing. No surprises." sub="Monthly plans, cancel anytime. Setup covers design, copy, and launch. No contracts — we earn the renewal every month." />
      <section className="section-pad" style={{ background: "var(--color-forge-dark)" }}>
        <div className="price-grid" style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, alignItems: "start" }}>
          {tiers.map(t => (
            <div key={t.name} style={{ border: `1px solid ${t.featured ? "var(--color-copper)" : "var(--color-forge-border)"}`, background: "var(--color-forge-black)", borderRadius: 2, padding: 28, position: "relative" }}>
              {t.featured && <span style={{ position: "absolute", top: -11, left: 28, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-forge-black)", background: "var(--color-copper)", padding: "3px 10px", borderRadius: 3 }}>Most popular</span>}
              <div className="mono-label" style={{ marginBottom: 6 }}>{t.tag}</div>
              <h3 style={{ fontSize: 24, color: "var(--color-bone)", margin: "0 0 12px" }}>{t.name}</h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 500, color: "var(--color-bone)", fontFamily: "var(--font-display)" }}>{t.price}</span>
                <span style={{ color: "var(--color-forge-rust)", fontSize: 14 }}>/mo</span>
              </div>
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-forge-rust)", marginBottom: 22 }}>+ {t.setup}</div>
              <a onClick={() => go("contact")} className={t.featured ? "btn-primary" : "btn-outline"} style={{ width: "100%", justifyContent: "center", marginBottom: 22 }}>Get started</a>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {t.feats.map(f => (
                  <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--color-forge-muted)" }}>
                    <span style={{ color: "var(--color-copper)", marginTop: 1, flexShrink: 0 }}><Check size={14} /></span>{f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <>
      <PageHead label="Get a quote" title="Let's get you found." sub="Tell us about your trade and service area. We'll send a straight-up quote within one business day — no pressure, no sales script." />
      <section className="section-pad" style={{ background: "var(--color-forge-dark)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {sent ? (
            <div style={{ border: "1px solid rgba(0,200,150,0.3)", background: "rgba(0,200,150,0.08)", borderRadius: 2, padding: 32, textAlign: "center" }}>
              <span className="status-online" style={{ marginBottom: 12 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-system-green)" }} className="led-pulse" />REQUEST RECEIVED</span>
              <h3 style={{ color: "var(--color-bone)", fontSize: 22, margin: "8px 0" }}>Thanks — we'll be in touch.</h3>
              <p style={{ color: "var(--color-forge-muted)", fontSize: 14 }}>Expect a real reply from Billy within one business day.</p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[["Name","text","Your name"],["Business","text","e.g. Showalter Plumbing"],["Email","email","you@business.com"],["Phone","tel","(812) 555-0100"]].map(([l, ty, ph]) => (
                <label key={l} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className="mono-label">{l}</span>
                  <input type={ty} placeholder={ph} required style={inputStyle} />
                </label>
              ))}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="mono-label">What do you need?</span>
                <textarea rows={4} placeholder="New website, better ranking, more leads…" style={{ ...inputStyle, resize: "vertical" }} />
              </label>
              <button type="submit" className="btn-primary" style={{ justifyContent: "center", border: "none" }}>Send request <ArrowRight size={16} /></button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
const inputStyle = { background: "var(--color-forge-black)", border: "1px solid var(--color-forge-border)", borderRadius: 3, padding: "10px 12px", color: "var(--color-bone)", fontSize: 14, fontFamily: "var(--font-sans)", outline: "none" };

function Work() {
  return (
    <>
      <PageHead label="Case study" title="From 404 to found" sub="Lucas Construction — a general contractor in Terre Haute, IN — had no site and no presence. Here's what changed." />
      <section className="section-pad" style={{ background: "var(--color-forge-dark)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="work-grid">
          <div style={{ border: "1px solid var(--color-forge-border)", background: "var(--color-forge-black)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-forge-border)", display: "flex", justifyContent: "space-between" }}>
              <span className="mono-label">Before</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-error-red)" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-error-red)" }} />ERROR 404</span>
            </div>
            <div style={{ padding: 24 }}>
              {[["Google ranking","Not ranked"],["Monthly leads","3–4"],["Website","None"],["Reviews","2"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--color-forge-border)" }}>
                  <span style={{ color: "var(--color-forge-rust)", fontSize: 13 }}>{k}</span><span style={{ color: "var(--color-forge-muted)", fontSize: 13 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ border: "1px solid rgba(184,115,51,0.5)", background: "var(--color-forge-black)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-forge-border)", display: "flex", justifyContent: "space-between" }}>
              <span className="mono-label">After — 90 days</span>
              <span className="status-online"><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-system-green)" }} className="led-pulse" />LIVE</span>
            </div>
            <div style={{ padding: 24 }}>
              {[["Google ranking","#1–3 local"],["Monthly leads","28+"],["Website","Live in 2 wks"],["Reviews","41 ★ 4.9"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--color-forge-border)" }}>
                  <span style={{ color: "var(--color-forge-rust)", fontSize: 13 }}>{k}</span><span style={{ color: "var(--color-copper-light)", fontSize: 13, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function About() {
  return (
    <>
      <PageHead label="About" title="Built by a tradesman." sub="404 TradeOS is run by Billy Showalter — a licensed plumber (IN/IL), OSHA 30 certified, based in Terre Haute. We build for the trades because we came from the trades." />
      <section className="section-pad" style={{ background: "var(--color-forge-dark)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", color: "var(--color-forge-muted)", fontSize: 16, lineHeight: 1.75 }}>
          <p style={{ marginTop: 0 }}>We're not a coastal agency that read a blog post about your industry. We've been on the truck, on the roof, and under the sink. We know what a homeowner types into Google when their water heater fails — and we make sure your business is the one they find.</p>
          <p>No jargon. No lock-in contracts. We track your rankings monthly and tell you exactly what moved and why. If it's not working, we say so.</p>
        </div>
      </section>
    </>
  );
}

Object.assign(window, { Services, Pricing, Contact, Work, About });
