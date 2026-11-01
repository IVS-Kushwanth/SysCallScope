import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, BarChart3, Bell, BookOpen, ChevronDown, ChevronsLeft, ChevronsRight, Clock3, Cpu, FileText,
  FolderOpen, GitBranch, LayoutDashboard, Menu, MemoryStick, Play, Settings as SettingsIcon, User, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useOutlet } from "react-router-dom";
import { Background } from "../components/Background";
import { Logo, LogoMark } from "../components/Logo";
import { DemoBadge, LiveBadge, SessionStatus } from "../components/ui";
import { useTrace } from "../context/TraceContext";
import { fmtDate } from "../lib/format";

const NAV = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/trace", label: "Start Tracing", icon: Play },
  { to: "/app/live", label: "Live Trace", icon: Activity },
  { to: "/app/processes", label: "Process Explorer", icon: GitBranch },
  { to: "/app/syscalls", label: "System Call Explorer", icon: BookOpen },
  { to: "/app/timeline", label: "Execution Timeline", icon: Clock3 },
  { to: "/app/files", label: "File Operations", icon: FolderOpen },
  { to: "/app/memory", label: "Memory Analysis", icon: MemoryStick },
  { to: "/app/reports", label: "Reports", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];

function useClickAway(cb: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, [cb]);
  return ref;
}

function SidebarLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { isRunning } = useTrace();
  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Dashboard">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} title={collapsed ? n.label : undefined}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-cobalt/15 text-fog" : "text-muted hover:bg-white/[0.04] hover:text-fog"}`}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-lime" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />}
              <n.icon size={18} className={isActive ? "text-cobalt-300" : ""} />
              {!collapsed && <span className="truncate">{n.label}</span>}
              {n.to === "/app/live" && isRunning && <span className={`h-2 w-2 animate-pulseDot rounded-full bg-lime ${collapsed ? "absolute right-2 top-2" : "ml-auto"}`} />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SessionPicker() {
  const { sessions, activeId, setActiveId, mode, session } = useTrace();
  const [open, setOpen] = useState(false);
  const ref = useClickAway(() => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex max-w-[260px] items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-left text-sm hover:border-white/20" aria-haspopup="listbox" aria-expanded={open}>
        <span className="truncate">{session ? session.name : sessions.length ? "Select a trace" : "No traces yet"}</span>
        {session && <span className="font-mono text-[11px] text-muted">{session.id.slice(-6)}</span>}
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} role="listbox"
            className="absolute left-0 top-full z-50 mt-2 max-h-80 w-[340px] overflow-y-auto rounded-xl border border-line bg-card p-1.5 shadow-2xl">
            {sessions.length === 0 && <li className="px-3 py-3 text-xs text-muted">No {mode === "demo" ? "demo" : "live"} sessions yet.</li>}
            {sessions.map((s) => (
              <li key={s.id}>
                <button onClick={() => { setActiveId(s.id); setOpen(false); }} role="option" aria-selected={s.id === activeId}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5 ${s.id === activeId ? "bg-cobalt/15" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{s.name}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted">{fmtDate(s.started_at)} · {s.event_count} events</div>
                  </div>
                  <SessionStatus status={s.status} />
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Notifications() {
  const { notices } = useTrace();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const ref = useClickAway(() => setOpen(false));
  const unread = notices.filter((n) => n.at > seen).length;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setOpen((o) => !o); setSeen(Date.now()); }} className="relative rounded-lg p-2 text-muted hover:bg-white/5 hover:text-fog" aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-lime" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-line bg-card p-2 shadow-2xl">
            <div className="px-2 py-1.5 text-xs font-medium text-muted">Notifications</div>
            {notices.length === 0 && <div className="px-2 py-4 text-sm text-muted">Trace results and errors will appear here.</div>}
            <ul className="max-h-80 overflow-y-auto">
              {notices.map((n) => (
                <li key={n.id} className="rounded-lg px-2 py-2 hover:bg-white/5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`h-1.5 w-1.5 rounded-full ${n.kind === "error" ? "bg-danger" : n.kind === "success" ? "bg-lime" : "bg-cobalt-300"}`} />{n.title}
                  </div>
                  {n.body && <div className="mt-0.5 pl-3.5 text-xs text-muted">{n.body}</div>}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EnvStatus() {
  const { env, backendUp } = useTrace();
  let color = "#9299A8", text = "Checking backend…";
  if (backendUp === false) { color = "#FF5252"; text = "Backend offline"; }
  else if (env) {
    if (env.tracing_possible) { color = "#D4FF24"; text = env.is_wsl ? "WSL2 · strace ready" : "Linux · strace ready"; }
    else if (!env.is_linux) { color = "#FFB547"; text = `${env.platform} · demo only`; }
    else if (!env.strace_available) { color = "#FFB547"; text = "strace not installed"; }
    else { color = "#FF5252"; text = "ptrace restricted"; }
  }
  return (
    <span className="hidden items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted lg:inline-flex" title={env?.ptrace_note}>
      <Cpu size={14} style={{ color }} />{text}
    </span>
  );
}

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { mode, setMode, isRunning, session } = useTrace();
  const loc = useLocation();
  const outlet = useOutlet();

  return (
    <div className="flex min-h-screen">
      <Background density={0.45} />
      {/* desktop sidebar */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-ink/70 backdrop-blur-xl transition-[width] duration-300 lg:flex ${collapsed ? "w-[72px]" : "w-[248px]"}`}>
        <div className="flex h-16 items-center border-b border-line px-4">
          {collapsed ? <LogoMark /> : <Logo to="/" />}
        </div>
        <SidebarLinks collapsed={collapsed} />
        <div className="border-t border-line p-3">
          <button onClick={() => setCollapsed((c) => !c)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-fog" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} />Collapse</>}
          </button>
        </div>
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-line bg-ink lg:hidden">
              <div className="flex h-16 items-center justify-between border-b border-line px-4">
                <Logo to="/" />
                <button onClick={() => setMobileOpen(false)} className="p-1 text-muted" aria-label="Close menu"><X size={18} /></button>
              </div>
              <SidebarLinks collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-ink/70 px-4 backdrop-blur-xl lg:px-6">
          <button className="rounded-md p-2 text-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="lg:hidden"><LogoMark /></div>
          <div className="hidden sm:block"><SessionPicker /></div>
          {isRunning ? <LiveBadge /> : session && <span className="hidden md:inline"><SessionStatus status={session.status} /></span>}
          {mode === "demo" && <DemoBadge className="hidden md:inline-flex" />}
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden rounded-lg border border-line bg-surface p-0.5 text-xs md:flex" role="tablist" aria-label="Data source">
              {(["live", "demo"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                  className={`rounded-md px-2.5 py-1 transition-colors ${mode === m ? "bg-cobalt text-white" : "text-muted hover:text-fog"}`}>
                  {m === "live" ? "Live Linux" : "Demo"}
                </button>
              ))}
            </div>
            <EnvStatus />
            <Notifications />
            <div className="grid h-8 w-8 place-items-center rounded-full border border-line bg-card text-muted" title="Local user"><User size={15} /></div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: "easeOut" }}>
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="flex items-center gap-2 border-t border-line px-6 py-3 text-[11px] text-muted">
          <FileText size={12} />Data shown comes from the selected {mode === "demo" ? "demo" : "live"} trace session.
        </footer>
      </div>
    </div>
  );
}
