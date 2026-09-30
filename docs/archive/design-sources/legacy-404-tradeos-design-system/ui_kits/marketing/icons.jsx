/* Lucide-style inline icons (stroke 2, round caps) — the sanctioned icon set.
   Self-contained so the kit renders without a CDN. */
const Ico = ({ d, size = 18, fill = "none", ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const ArrowRight = (p) => <Ico {...p} d="M5 12h14M12 5l7 7-7 7" />;
const Target = (p) => <Ico {...p} d={<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>} />;
const Zap = (p) => <Ico {...p} d="M4 14h7l-1 7 9-11h-7l1-7-9 11z" />;
const MapPin = (p) => <Ico {...p} d={<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>} />;
const Phone = (p) => <Ico {...p} d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />;
const Search = (p) => <Ico {...p} d={<><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></>} />;
const BarChart = (p) => <Ico {...p} d={<><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></>} />;
const RefreshCw = (p) => <Ico {...p} d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16m0 5v-5h5" />;
const Smartphone = (p) => <Ico {...p} d={<><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></>} />;
const Star = (p) => <Ico {...p} d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z" />;
const Check = (p) => <Ico {...p} d="M20 6L9 17l-5-5" />;
const Menu = (p) => <Ico {...p} d="M4 6h16M4 12h16M4 18h16" />;
const Users = (p) => <Ico {...p} d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>} />;
const Folder = (p) => <Ico {...p} d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />;
const FileText = (p) => <Ico {...p} d={<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5M9 13h6M9 17h6"/></>} />;
const Plus = (p) => <Ico {...p} d="M12 5v14M5 12h14" />;
const LayoutGrid = (p) => <Ico {...p} d={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>} />;

Object.assign(window, { Ico, ArrowRight, Target, Zap, MapPin, Phone, Search, BarChart, RefreshCw, Smartphone, Star, Check, Menu, Users, Folder, FileText, Plus, LayoutGrid });
