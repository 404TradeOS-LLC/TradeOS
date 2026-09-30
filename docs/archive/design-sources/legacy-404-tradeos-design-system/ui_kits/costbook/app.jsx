/* TradeOS CostBook — internal estimating/invoicing app.
   Neutral shadcn/ui styling (light, grayscale) — intentionally NOT the copper brand. */
const { useState } = React;

const Plus = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
);

const C = {
  bg: "#ffffff", muted: "#f6f6f6", fg: "#252525", mutedFg: "#737373",
  border: "#e6e6e6", primary: "#252525", primaryFg: "#fafafa", radius: 10,
  green: "#16a34a", amber: "#d97706", blue: "#2563eb", red: "#dc2626",
  font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
};

function Btn({ variant = "default", size = "default", children, ...p }) {
  const base = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: C.font, fontSize: size === "sm" ? 13 : 14, fontWeight: 500, borderRadius: 8, cursor: "pointer", border: "1px solid transparent", padding: size === "sm" ? "5px 10px" : "8px 14px", whiteSpace: "nowrap", transition: "background .15s" };
  const v = {
    default: { background: C.primary, color: C.primaryFg },
    outline: { background: C.bg, color: C.fg, borderColor: C.border },
    ghost: { background: "transparent", color: C.fg },
  }[variant];
  return <button style={{ ...base, ...v }} {...p}>{children}</button>;
}

function Badge({ tone = "muted", children }) {
  const tones = {
    muted: { bg: C.muted, fg: C.mutedFg, bd: C.border },
    green: { bg: "#f0fdf4", fg: C.green, bd: "#bbf7d0" },
    amber: { bg: "#fffbeb", fg: C.amber, bd: "#fde68a" },
    blue: { bg: "#eff6ff", fg: C.blue, bd: "#bfdbfe" },
  }[tone];
  return <span style={{ display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 500, padding: "2px 9px", borderRadius: 999, background: tones.bg, color: tones.fg, border: `1px solid ${tones.bd}`, fontFamily: C.font }}>{children}</span>;
}

function Card({ children, style }) {
  return <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: C.radius, ...style }}>{children}</div>;
}

const STATUS = { lead: "muted", estimating: "amber", active: "blue", won: "green", completed: "green" };
const PROJECTS = [
  { id: 1, name: "Maple St. bathroom remodel", customer: "R. Delgado", status: "active", value: "$14,200" },
  { id: 2, name: "Warehouse panel upgrade", customer: "Terre Haute Storage", status: "estimating", value: "$8,750" },
  { id: 3, name: "Rooftop HVAC replacement (x3)", customer: "Wabash Property Mgmt", status: "won", value: "$31,400" },
  { id: 4, name: "New construction rough-in", customer: "Lucas Construction", status: "active", value: "$52,900" },
  { id: 5, name: "Water heater swap", customer: "J. Okafor", status: "lead", value: "$2,300" },
  { id: 6, name: "Restaurant grease-trap line", customer: "Sycamore Diner", status: "completed", value: "$6,100" },
];
const LINE_ITEMS = [
  ["Demo & haul-away", "1 job", "$1,200", "$1,200"],
  ['3/4" copper supply lines', "180 ft", "$4.20", "$756"],
  ["Fixture set — tub/shower", "1 ea", "$2,450", "$2,450"],
  ["Labor — journeyman", "48 hr", "$95", "$4,560"],
  ["Permit & inspection", "1 ea", "$340", "$340"],
];

function Nav({ page, go, email }) {
  const links = [["dashboard", "Dashboard"], ["customers", "Customers"], ["projects", "Projects"]];
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, padding: "12px 24px", background: C.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: C.fg }}>TradeOS <span style={{ color: C.mutedFg, fontWeight: 500 }}>CostBook</span></span>
        <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
          {links.map(([k, l]) => <a key={k} onClick={() => go(k)} style={{ cursor: "pointer", color: page === k ? C.fg : C.mutedFg, fontWeight: page === k ? 500 : 400 }}>{l}</a>)}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: C.mutedFg }}>
        <span>{email}</span>
        <Btn variant="outline" size="sm" onClick={() => go("login")}>Sign out</Btn>
      </div>
    </header>
  );
}

function Dashboard({ go }) {
  const stats = [["Open projects", "4"], ["Estimating", "1"], ["Won this month", "$31,400"], ["Customers", "12"]];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div><h1 style={h1s}>Dashboard</h1><p style={subs}>Signed in as billy@404tradeos.com · role: owner</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }} className="cb-stats">
        {stats.map(([k, v]) => <Card key={k} style={{ padding: 18 }}><div style={{ fontSize: 13, color: C.mutedFg, marginBottom: 6 }}>{k}</div><div style={{ fontSize: 26, fontWeight: 600, color: C.fg }}>{v}</div></Card>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="cb-2col">
        <Card style={{ padding: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: C.fg }}>Customers</div>
          <p style={{ ...subs, marginBottom: 16 }}>Manage the people and companies you bid work for.</p>
          <Btn variant="outline" size="sm" onClick={() => go("customers")}>View customers</Btn>
        </Card>
        <Card style={{ padding: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: C.fg }}>Projects</div>
          <p style={{ ...subs, marginBottom: 16 }}>Track jobs from lead through estimate to completion.</p>
          <Btn variant="outline" size="sm" onClick={() => go("projects")}>View projects</Btn>
        </Card>
      </div>
    </div>
  );
}

function Projects({ go, open }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={h1s}>Projects</h1>
        <Btn onClick={() => go("new")}><Plus size={15} />New project</Btn>
      </div>
      <Card>
        {PROJECTS.map((p, i) => (
          <div key={p.id} onClick={() => open(p)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderTop: i ? `1px solid ${C.border}` : "none", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = C.muted} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.fg }}>{p.name}</div>
              <div style={{ fontSize: 13, color: C.mutedFg, marginTop: 2 }}>{p.customer}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 14, color: C.fg, fontVariantNumeric: "tabular-nums" }}>{p.value}</span>
              <Badge tone={STATUS[p.status]}>{p.status}</Badge>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ProjectDetail({ back, project }) {
  const [tab, setTab] = useState("Estimate");
  const tabs = ["Estimate", "Proposal", "Contract", "Invoices"];
  const total = "$9,306";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <a onClick={back} style={{ fontSize: 13, color: C.mutedFg, cursor: "pointer" }}>← Projects</a>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <h1 style={h1s}>{project.name}</h1>
          <Badge tone={STATUS[project.status]}>{project.status}</Badge>
        </div>
        <p style={subs}>{project.customer} · Project #{project.id}</p>
      </div>
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}` }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: C.font, fontSize: 14, padding: "8px 12px", color: tab === t ? C.fg : C.mutedFg, fontWeight: tab === t ? 500 : 400, borderBottom: `2px solid ${tab === t ? C.fg : "transparent"}`, marginBottom: -1 }}>{t}</button>
        ))}
      </div>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1fr 1fr", padding: "10px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.mutedFg, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <span>Item</span><span style={{ textAlign: "right" }}>Qty</span><span style={{ textAlign: "right" }}>Unit</span><span style={{ textAlign: "right" }}>Total</span>
        </div>
        {LINE_ITEMS.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1fr 1fr", padding: "12px 18px", borderTop: i ? `1px solid ${C.border}` : "none", fontSize: 14, color: C.fg }}>
            <span>{r[0]}</span>
            <span style={{ textAlign: "right", color: C.mutedFg, fontVariantNumeric: "tabular-nums" }}>{r[1]}</span>
            <span style={{ textAlign: "right", color: C.mutedFg, fontVariantNumeric: "tabular-nums" }}>{r[2]}</span>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r[3]}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderTop: `2px solid ${C.border}`, background: C.muted }}>
          <span style={{ fontSize: 13, color: C.mutedFg }}>Subtotal · materials + labor</span>
          <span style={{ fontSize: 18, fontWeight: 600, color: C.fg, fontVariantNumeric: "tabular-nums" }}>{total}</span>
        </div>
      </Card>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn>Send {tab.toLowerCase()}</Btn>
        <Btn variant="outline">Add line item</Btn>
        <Btn variant="ghost">Export PDF</Btn>
      </div>
    </div>
  );
}

function NewProject({ back }) {
  return (
    <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 18 }}>
      <div><a onClick={back} style={{ fontSize: 13, color: C.mutedFg, cursor: "pointer" }}>← Projects</a><h1 style={{ ...h1s, marginTop: 8 }}>New project</h1></div>
      {[["Project name", "e.g. Maple St. bathroom remodel"], ["Customer", "Search or add a customer"], ["Estimated value", "$0.00"]].map(([l, ph]) => (
        <label key={l} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.fg }}>{l}</span>
          <input placeholder={ph} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, fontFamily: C.font, color: C.fg, outline: "none" }} />
        </label>
      ))}
      <div style={{ display: "flex", gap: 10 }}><Btn onClick={back}>Create project</Btn><Btn variant="outline" onClick={back}>Cancel</Btn></div>
    </div>
  );
}

function Customers() {
  const rows = [["R. Delgado", "Homeowner", "2 projects"], ["Lucas Construction", "GC · Terre Haute", "5 projects"], ["Wabash Property Mgmt", "Commercial", "3 projects"], ["Sycamore Diner", "Commercial", "1 project"], ["J. Okafor", "Homeowner", "1 project"]];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h1 style={h1s}>Customers</h1><Btn><Plus size={15} />New customer</Btn></div>
      <Card>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <div><div style={{ fontSize: 14, fontWeight: 500, color: C.fg }}>{r[0]}</div><div style={{ fontSize: 13, color: C.mutedFg, marginTop: 2 }}>{r[1]}</div></div>
            <span style={{ fontSize: 13, color: C.mutedFg }}>{r[2]}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Login({ go }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.muted }}>
      <Card style={{ padding: 32, width: 360 }}>
        <div style={{ fontWeight: 600, fontSize: 18, color: C.fg }}>TradeOS <span style={{ color: C.mutedFg, fontWeight: 500 }}>CostBook</span></div>
        <p style={{ ...subs, marginTop: 4, marginBottom: 22 }}>Sign in to your workspace.</p>
        <form onSubmit={e => { e.preventDefault(); go("dashboard"); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[["Email", "billy@404tradeos.com", "email"], ["Password", "••••••••", "password"]].map(([l, ph, ty]) => (
            <label key={l} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.fg }}>{l}</span>
              <input type={ty} defaultValue={ty === "email" ? ph : ""} placeholder={ph} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, fontFamily: C.font, color: C.fg, outline: "none" }} />
            </label>
          ))}
          <Btn style={{ marginTop: 4 }}>Sign in</Btn>
        </form>
      </Card>
    </div>
  );
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [project, setProject] = useState(PROJECTS[0]);
  const go = p => { setPage(p); window.scrollTo(0, 0); };
  const open = p => { setProject(p); setPage("detail"); window.scrollTo(0, 0); };
  if (page === "login") return <Login go={go} />;
  const body = {
    dashboard: <Dashboard go={go} />, projects: <Projects go={go} open={open} />,
    detail: <ProjectDetail back={() => go("projects")} project={project} />,
    new: <NewProject back={() => go("projects")} />, customers: <Customers />,
  }[page] || <Dashboard go={go} />;
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: C.font, color: C.fg }}>
      <Nav page={page === "detail" || page === "new" ? "projects" : page} go={go} email="billy@404tradeos.com" />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>{body}</main>
    </div>
  );
}
const h1s = { fontSize: 24, fontWeight: 600, margin: 0, color: C.fg, fontFamily: C.font };
const subs = { fontSize: 14, color: C.mutedFg, margin: "4px 0 0", fontFamily: C.font };

Object.assign(window, { CostBookApp: App });
