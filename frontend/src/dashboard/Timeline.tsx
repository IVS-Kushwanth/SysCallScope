import { ArrowDownUp, RotateCcw, Search, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState } from "react";
import { EventDetail } from "../components/EventDetail";
import { NoSession } from "../components/NoSession";
import { Chart } from "../components/Plot";
import { Button, DemoBadge, PageHeader, Panel, StatusPill, useDebounced } from "../components/ui";
import { useAnalysis, useTrace } from "../context/TraceContext";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABEL, fmtDuration, fmtRelMs, truncate } from "../lib/format";
import { api } from "../services/api";
import type { TraceEvent } from "../services/types";

const MAX_POINTS = 6000;

export default function Timeline() {
  const { activeId, events, mode } = useTrace();
  const { data: stats } = useAnalysis(api.stats);
  const { data: tree } = useAnalysis(api.processes);
  const [pid, setPid] = useState("");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [sortDesc, setSortDesc] = useState(false);
  const [sortBy, setSortBy] = useState<"ts" | "duration">("ts");
  const [range, setRange] = useState<[number, number] | null>(null);
  const [sel, setSel] = useState<TraceEvent | null>(null);
  const dq = useDebounced(q, 150);

  const t0 = events[0]?.ts ?? 0;
  const tEnd = events.length ? Math.max(...events.slice(-200).map((e) => e.ts + (e.duration ?? 0))) : 0;
  const threshold = stats?.long_threshold ?? 0.001;

  const pids = useMemo(() => Array.from(new Set(events.map((e) => e.pid))), [events]);
  const rootSet = useMemo(() => new Set(tree?.roots ?? []), [tree]);

  const filtered = useMemo(() => {
    const s = dq.trim().toLowerCase();
    return events.filter((e) => (!pid || String(e.pid) === pid) && (!cat || e.category === cat) &&
      (!s || e.name.toLowerCase().includes(s) || (e.args ?? "").toLowerCase().includes(s)));
  }, [events, pid, cat, dq]);

  const plotted = filtered.length > MAX_POINTS ? filtered.slice(0, MAX_POINTS) : filtered;

  const traces = useMemo(() => {
    const byCat: Record<string, TraceEvent[]> = {};
    for (const e of plotted) (byCat[e.category] ??= []).push(e);
    const out: any[] = Object.entries(byCat).map(([c, list]) => ({
      type: "scattergl", mode: "markers", name: CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL],
      x: list.map((e) => (e.ts - t0) * 1000),
      y: list.map((e) => `PID ${e.pid}${rootSet.has(e.pid) ? " (parent)" : ""}`),
      customdata: list.map((e) => e.seq),
      text: list.map((e) => `${e.name}() ${e.status}${e.errno ? " " + e.errno : ""}<br>${fmtDuration(e.duration)}`),
      hovertemplate: "%{text}<br>+%{x:.3f} ms<extra>%{y}</extra>",
      error_x: { type: "data", symmetric: false, array: list.map((e) => (e.duration ?? 0) * 1000), arrayminus: list.map(() => 0), color: CATEGORY_COLORS[c as keyof typeof CATEGORY_COLORS], thickness: 2, width: 0 },
      marker: {
        size: list.map((e) => ((e.duration ?? 0) >= threshold ? 13 : 8)),
        color: list.map((e) => (e.status === "failed" ? "#FF5252" : CATEGORY_COLORS[e.category])),
        symbol: list.map((e) => (e.status === "failed" ? "x" : e.kind === "signal" ? "diamond" : e.kind !== "syscall" ? "square" : "circle")),
        line: { width: list.map((e) => ((e.duration ?? 0) >= threshold ? 2 : 0)), color: "#D4FF24" },
        opacity: 0.9,
      },
    }));
    return out;
  }, [plotted, t0, threshold, rootSet]);

  const table = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => sortBy === "ts" ? a.ts - b.ts || a.seq - b.seq : (a.duration ?? 0) - (b.duration ?? 0));
    if (sortDesc) arr.reverse();
    if (range) return arr.filter((e) => { const x = (e.ts - t0) * 1000; return x >= range[0] && x <= range[1]; });
    return arr;
  }, [filtered, sortBy, sortDesc, range, t0]);

  if (!activeId) return (<><PageHeader title="Execution timeline" /><NoSession what="The execution timeline" /></>);

  const span = (tEnd - t0) * 1000;
  const zoom = (factor: number) => {
    const [a, b] = range ?? [0, span];
    const mid = (a + b) / 2, half = ((b - a) / 2) * factor;
    setRange([Math.max(0, mid - half), Math.min(span, mid + half)]);
  };
  const onRelayout = (ev: any) => {
    if (ev["xaxis.autorange"]) setRange(null);
    else if (ev["xaxis.range[0]"] != null) setRange([ev["xaxis.range[0]"], ev["xaxis.range[1]"]]);
  };
  const longCount = filtered.filter((e) => (e.duration ?? 0) >= threshold).length;

  return (
    <div>
      <PageHeader title="Execution timeline" description="Each marker is a system call at its real -ttt timestamp; the tail after it is the -T duration. Calls ringed in lime took unusually long."
        actions={mode === "demo" ? <DemoBadge /> : undefined} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9 font-mono" placeholder="Search system calls" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search system calls" />
        </div>
        <select className="input w-auto" value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Filter by PID">
          <option value="">All PIDs</option>{pids.map((p) => <option key={p} value={p}>PID {p}{rootSet.has(p) ? " (parent)" : ""}</option>)}
        </select>
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <Button size="sm" variant="secondary" icon={ZoomIn} onClick={() => zoom(0.5)} aria-label="Zoom in">Zoom in</Button>
        <Button size="sm" variant="secondary" icon={ZoomOut} onClick={() => zoom(2)} aria-label="Zoom out">Zoom out</Button>
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setRange(null)}>Reset</Button>
      </div>

      <Panel title="Calls over time by process" subtitle={`${filtered.length.toLocaleString()} events · ${longCount} above ${fmtDuration(threshold)} (95th percentile)${filtered.length > MAX_POINTS ? ` · first ${MAX_POINTS} plotted` : ""}`}>
        <Chart height={Math.max(260, 90 + pids.length * 46)} data={traces} onRelayout={onRelayout}
          onClick={(ev) => { const seq = ev.points?.[0]?.customdata; const e = events.find((x) => x.seq === seq); if (e) setSel(e); }}
          layout={{
            margin: { l: 130, b: 80 }, legend: { y: -0.4 }, showlegend: true, hovermode: "closest", dragmode: "zoom",
            xaxis: { title: { text: "milliseconds since first event" }, range: range ?? undefined, autorange: range ? false : true },
            yaxis: { type: "category", tickfont: { family: "IBM Plex Mono", color: "#F5F7FA" } },
          }} />
        <p className="mt-2 text-[11px] text-muted">Drag across the chart to zoom into a time window; the table below follows the visible range. Click a marker to inspect it.</p>
      </Panel>

      <div className="panel mt-6 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 className="text-[15px] font-semibold">Events{range ? ` in ${range[0].toFixed(2)}–${range[1].toFixed(2)} ms` : ""}</h3>
          <div className="flex gap-2">
            <select className="input h-8 w-auto py-0 text-xs" value={sortBy} onChange={(e) => setSortBy(e.target.value as "ts" | "duration")} aria-label="Sort by">
              <option value="ts">Sort by time</option><option value="duration">Sort by duration</option>
            </select>
            <Button size="sm" variant="secondary" icon={ArrowDownUp} onClick={() => setSortDesc((s) => !s)}>{sortDesc ? "Descending" : "Ascending"}</Button>
          </div>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="table-head"><tr><th>Time</th><th>PID</th><th>System call</th><th>Duration</th><th>Status</th><th>Arguments</th></tr></thead>
            <tbody>
              {table.slice(0, 1500).map((e) => {
                const long = (e.duration ?? 0) >= threshold;
                return (
                  <tr key={e.seq} onClick={() => setSel(e)} className={`table-row cursor-pointer hover:bg-white/[0.04] ${long ? "bg-lime/[0.04]" : ""}`}>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">{fmtRelMs(e.ts, t0)}</td>
                    <td className="whitespace-nowrap font-mono text-xs">{e.pid}{rootSet.has(e.pid) && <span className="ml-1 text-cobalt-300">parent</span>}</td>
                    <td className="whitespace-nowrap font-mono text-xs"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLORS[e.category] }} />{e.name}</td>
                    <td className={`whitespace-nowrap font-mono text-xs ${long ? "font-semibold text-lime" : ""}`}>{fmtDuration(e.duration)}</td>
                    <td><StatusPill status={e.status} /></td>
                    <td className="max-w-[420px] truncate font-mono text-xs text-fog/60">{truncate(e.args, 90)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {table.length > 1500 && <p className="p-3 text-center text-xs text-muted">Showing 1,500 of {table.length.toLocaleString()} events. Zoom or filter to narrow the list.</p>}
        </div>
      </div>
      <EventDetail event={sel} onClose={() => setSel(null)} />
    </div>
  );
}
