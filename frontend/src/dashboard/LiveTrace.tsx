import { ArrowDownToLine, Pause, Search, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EventDetail } from "../components/EventDetail";
import { NoSession } from "../components/NoSession";
import { AnimatedNumber, Button, DemoBadge, LiveBadge, PageHeader, SessionStatus, useDebounced } from "../components/ui";
import { useTrace } from "../context/TraceContext";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABEL, eventTone, fmtClock, fmtDuration, truncate } from "../lib/format";
import { api } from "../services/api";
import type { TraceEvent } from "../services/types";

const MAX_ROWS = 2000;

const TONE: Record<ReturnType<typeof eventTone>, { row: string; tag: string; label: string }> = {
  ok: { row: "", tag: "text-lime", label: "SUCCESS" },
  fail: { row: "bg-danger/[0.06]", tag: "text-danger", label: "FAILED" },
  spawn: { row: "bg-cobalt/[0.10]", tag: "text-cobalt-300", label: "PROCESS" },
  end: { row: "bg-white/[0.03]", tag: "text-cobalt-300", label: "EXIT" },
  signal: { row: "bg-warn/[0.07]", tag: "text-warn", label: "SIGNAL" },
  memory: { row: "", tag: "text-[#6A9BF0]", label: "MEMORY" },
};

export default function LiveTrace() {
  const { activeId, session, events, isRunning, mode, notify } = useTrace();
  const [name, setName] = useState("");
  const [pid, setPid] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [follow, setFollow] = useState(true);
  const [selected, setSelected] = useState<TraceEvent | null>(null);
  const [stopping, setStopping] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const dName = useDebounced(name, 150);

  const pids = useMemo(() => Array.from(new Set(events.map((e) => e.pid))), [events]);
  const filtered = useMemo(() => {
    const q = dName.trim().toLowerCase();
    return events.filter((e) =>
      (!q || e.name.toLowerCase().includes(q) || (e.args ?? "").toLowerCase().includes(q)) &&
      (!pid || String(e.pid) === pid) &&
      (!status || e.status === status) &&
      (!category || e.category === category));
  }, [events, dName, pid, status, category]);
  const rows = filtered.length > MAX_ROWS ? filtered.slice(-MAX_ROWS) : filtered;

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: 0, failed: 0 };
    for (const e of events) {
      if (e.kind !== "syscall") continue;
      c.total++;
      if (e.status === "failed") c.failed++;
      c[e.category] = (c[e.category] ?? 0) + 1;
    }
    return c;
  }, [events]);

  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [rows.length, follow]);

  if (!activeId || !session) return (<><PageHeader title="Live trace" /><NoSession what="The live event stream" /></>);

  const stop = async () => {
    setStopping(true);
    try { await api.stopTrace(session.id); } catch (e: any) { notify({ kind: "error", title: "Stop failed", body: e.message }); }
    setStopping(false);
  };

  return (
    <div>
      <PageHeader title="Live trace" description={`Every system call from ${session.name}, in the order strace recorded it. Click a line for details.`}
        actions={<>
          {mode === "demo" && <DemoBadge />}
          {isRunning ? <LiveBadge /> : <SessionStatus status={session.status} />}
          {isRunning && <Button variant="danger" size="sm" icon={Square} onClick={stop} disabled={stopping}>{stopping ? "Stopping…" : "Stop tracing"}</Button>}
        </>} />

      <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-5 xl:grid-cols-9">
        {[["Calls", counts.total, "#F5F7FA"], ["Failed", counts.failed, "#FF5252"], ...CATEGORIES.map((c) => [CATEGORY_LABEL[c], counts[c] ?? 0, CATEGORY_COLORS[c]])].map(([l, v, c]) => (
          <div key={l as string} className="panel-flat px-3 py-2.5">
            <div className="text-[11px] text-muted">{l}</div>
            <div className="mt-0.5 font-mono text-lg" style={{ color: c as string }}><AnimatedNumber value={v as number} /></div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9 font-mono" placeholder="Filter by call name or argument" value={name} onChange={(e) => setName(e.target.value)} aria-label="Filter by system call name" />
        </div>
        <select className="input w-auto" value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Filter by PID">
          <option value="">All PIDs</option>{pids.map((p) => <option key={p} value={p}>PID {p}</option>)}
        </select>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">Any status</option>
          {["success", "failed", "interrupted", "unfinished", "signal", "exit"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <Button variant={follow ? "primary" : "secondary"} size="sm" icon={follow ? ArrowDownToLine : Pause} onClick={() => setFollow((f) => !f)}>
          {follow ? "Following" : "Paused"}
        </Button>
      </div>

      <div className={`overflow-hidden rounded-xl border border-line bg-ink ${isRunning ? "glow-border" : ""}`}>
        <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2 font-mono text-[11px] text-muted">
          <span>{session.command}</span>
          <span>{filtered.length.toLocaleString()} shown{filtered.length > MAX_ROWS ? ` (last ${MAX_ROWS})` : ""}</span>
        </div>
        <div ref={box} className="h-[58vh] min-h-[360px] overflow-auto font-mono text-[12px] leading-[1.7]"
          onWheel={(e) => { if (e.deltaY < 0) setFollow(false); }}>
          {rows.length === 0 && (
            <div className="grid h-full place-items-center text-muted">{isRunning ? "Waiting for the first system call…" : "No events match these filters."}</div>
          )}
          <table className="w-full border-collapse">
            <tbody>
              {rows.map((e) => {
                const t = TONE[eventTone(e)];
                return (
                  <tr key={e.seq} onClick={() => setSelected(e)} className={`animate-rowin cursor-pointer border-b border-white/[0.03] hover:bg-white/[0.05] ${t.row}`}>
                    <td className="whitespace-nowrap py-0.5 pl-4 pr-3 text-muted">[{fmtClock(e.ts)}]</td>
                    <td className="whitespace-nowrap pr-3 text-fog/70">PID {e.pid}</td>
                    <td className="whitespace-nowrap pr-3">
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: CATEGORY_COLORS[e.category] }} />
                      <span className="text-fog">{e.kind === "syscall" ? `${e.name}()` : e.name}</span>
                    </td>
                    <td className={`whitespace-nowrap pr-3 font-semibold ${t.tag}`}>{e.status === "failed" ? `FAILED ${e.errno ?? ""}` : e.status === "unfinished" ? "UNFINISHED" : e.status === "interrupted" ? "INTERRUPTED" : t.label}</td>
                    <td className="max-w-0 w-full truncate pr-3 text-fog/50">{truncate(e.args, 140)}{e.ret != null && e.kind === "syscall" ? <span className="text-fog/70"> = {e.ret}</span> : null}</td>
                    <td className="whitespace-nowrap pr-4 text-right text-muted">{fmtDuration(e.duration)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <EventDetail event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
