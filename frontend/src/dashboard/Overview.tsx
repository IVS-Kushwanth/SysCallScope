import { AlertOctagon, CheckCircle2, Clock3, FileText, GitBranch, Hash, Play, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Chart } from "../components/Plot";
import { NoSession } from "../components/NoSession";
import { Button, DemoBadge, PageHeader, Panel, SessionStatus, Skeleton, StatCard } from "../components/ui";
import { useAnalysis, useTrace } from "../context/TraceContext";
import { CATEGORY_COLORS, CATEGORIES, CATEGORY_LABEL, fmtDate, fmtDuration } from "../lib/format";
import { api } from "../services/api";
import type { Category } from "../services/types";

export default function Overview() {
  const { session, activeId, isRunning, mode, notify } = useTrace();
  const { data: stats, loading } = useAnalysis(api.stats);
  const { data: tree } = useAnalysis(api.processes);
  const nav = useNavigate();
  const [stopping, setStopping] = useState(false);

  const topCalls = useMemo(() => (stats ? Object.entries(stats.by_name).slice(0, 15) : []), [stats]);

  if (!activeId) return (<><PageHeader title="Overview" description="A summary of the selected trace session." /><NoSession what="The trace summary" /></>);
  if (loading || !stats || !session) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      </div>
    );
  }

  const stop = async () => {
    setStopping(true);
    try { await api.stopTrace(session.id); } catch (e: any) { notify({ kind: "error", title: "Stop failed", body: e.message }); }
    setStopping(false);
  };

  const cats = CATEGORIES.filter((c) => stats.by_category[c]);
  const pidCounts = Object.entries(stats.per_pid);
  const procs = tree?.processes ?? [];

  return (
    <div>
      <PageHeader
        title={session.name}
        description={session.command ?? undefined}
        actions={
          <>
            {mode === "demo" && <DemoBadge />}
            <SessionStatus status={session.status} />
            {isRunning ? (
              <Button variant="danger" size="sm" icon={Square} disabled={stopping} onClick={stop}>Stop tracing</Button>
            ) : (
              <Button size="sm" icon={Play} onClick={() => nav("/app/trace")}>New trace</Button>
            )}
          </>
        }
      />
      {session.error && <div className="mb-5 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">{session.error}</div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard index={0} label="Total system calls" value={stats.total} icon={Hash} />
        <StatCard index={1} label="Successful calls" value={stats.successful} icon={CheckCircle2} accent="lime" />
        <StatCard index={2} label="Failed calls" value={stats.failed} icon={AlertOctagon} accent="danger" hint={stats.interrupted + stats.unfinished ? `${stats.interrupted + stats.unfinished} interrupted or unfinished` : undefined} />
        <StatCard index={3} label="Processes created" value={stats.processes_created} icon={GitBranch} hint={`${stats.unique_pids} PIDs observed`} />
        <StatCard index={4} label="Files accessed" value={stats.files_accessed} icon={FileText} />
        <StatCard index={5} label="Total execution time" value={stats.execution_time * 1000} icon={Clock3} accent="muted"
          format={(n) => `${n.toFixed(n < 10 ? 2 : 1)} ms`} hint={`${fmtDuration(stats.syscall_time)} in syscalls, summed over PIDs`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="System calls by type" subtitle="Most frequent calls, coloured by category">
          <Chart height={320}
            data={[{
              type: "bar", orientation: "h",
              y: topCalls.map(([n]) => n).reverse(), x: topCalls.map(([, c]) => c).reverse(),
              marker: { color: topCalls.map(([n]) => CATEGORY_COLORS[(stats.per_call.find((p) => p.name === n)?.category ?? "other") as Category]).reverse() },
              hovertemplate: "%{y}: %{x} calls<extra></extra>",
            }]}
            layout={{ margin: { l: 110 }, yaxis: { tickfont: { family: "IBM Plex Mono", color: "#F5F7FA" } } }} />
        </Panel>
        <Panel title="Successful versus failed" subtitle={`${((stats.successful / Math.max(1, stats.total)) * 100).toFixed(1)}% success rate`}>
          <Chart height={320}
            data={[{
              type: "pie", hole: 0.62, sort: false,
              labels: ["Successful", "Failed", "Interrupted / unfinished"],
              values: [stats.successful, stats.failed, stats.interrupted + stats.unfinished],
              marker: { colors: ["#D4FF24", "#FF5252", "#FFB547"], line: { color: "#030407", width: 2 } },
              textinfo: "none", hovertemplate: "%{label}: %{value}<extra></extra>",
            }]}
            layout={{ showlegend: true, legend: { y: -0.05 }, margin: { t: 10, b: 10, l: 10, r: 10 },
              annotations: [{ text: `<b>${stats.total}</b><br><span style="font-size:11px">calls</span>`, showarrow: false, font: { size: 22, color: "#F5F7FA", family: "IBM Plex Mono" } }] }} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Calls by category" subtitle="Where the program spent its kernel requests">
          <Chart height={260}
            data={[{ type: "bar", x: cats.map((c) => CATEGORY_LABEL[c]), y: cats.map((c) => stats.by_category[c]),
              marker: { color: cats.map((c) => CATEGORY_COLORS[c]) }, hovertemplate: "%{x}: %{y}<extra></extra>" }]} />
        </Panel>
        <Panel title="Process creation" subtitle={`${stats.processes_created} created · system calls per PID`}>
          <Chart height={260}
            data={[{ type: "bar", x: pidCounts.map(([p]) => `PID ${p}`), y: pidCounts.map(([, c]) => c),
              marker: { color: pidCounts.map(([p]) => (procs.find((x) => String(x.pid) === p)?.ppid ? "#6A9BF0" : "#1558C9")) },
              hovertemplate: "%{x}: %{y} calls<extra></extra>" }]} />
        </Panel>
        <Panel title="Execution duration distribution" subtitle="Per-call time reported by strace -T (log scale)">
          <Chart height={260}
            data={[{ type: "histogram", x: stats.durations.filter((d) => d > 0).map((d) => Math.log10(d)), nbinsx: 30,
              marker: { color: "#1558C9", line: { color: "#3B7BE8", width: 1 } }, hovertemplate: "10^%{x:.1f} µs: %{y} calls<extra></extra>" }]}
            layout={{ xaxis: { title: { text: "log10(duration in µs)" }, tickvals: [0, 1, 2, 3, 4, 5], ticktext: ["1 µs", "10 µs", "100 µs", "1 ms", "10 ms", "100 ms"] } }} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="System-call frequency over time" subtitle="Calls per time bucket across the trace">
          <FrequencyChart />
        </Panel>
        <Panel title="Session" subtitle={fmtDate(session.started_at)}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Program", session.program ?? "—"], ["Arguments", session.argv.join(" ") || "—"],
              ["Exit code", session.exit_code ?? "—"], ["Events stored", session.event_count],
              ["Signals", stats.signals], ["Avg call time", fmtDuration(stats.avg_duration)],
            ].map(([k, v]) => (
              <div key={k as string} className="panel-flat p-3">
                <dt className="text-[11px] text-muted">{k}</dt>
                <dd className="mt-1 break-all font-mono text-[12.5px]">{String(v)}</dd>
              </div>
            ))}
          </dl>
          {session.stdout && (
            <>
              <div className="label mt-4">Program output</div>
              <pre className="max-h-40 overflow-auto rounded-lg border border-line bg-ink p-3 font-mono text-[12px] text-fog/85">{session.stdout}</pre>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function FrequencyChart() {
  const { events } = useTrace();
  const data = useMemo(() => {
    const sys = events.filter((e) => e.kind === "syscall");
    if (!sys.length) return null;
    const t0 = sys[0].ts, t1 = sys[sys.length - 1].ts;
    const span = Math.max(t1 - t0, 1e-6);
    const n = Math.min(60, Math.max(10, Math.round(sys.length / 4)));
    const width = span / n;
    const byCat: Record<string, number[]> = {};
    for (const e of sys) {
      const b = Math.min(n - 1, Math.floor((e.ts - t0) / width));
      (byCat[e.category] ??= new Array(n).fill(0))[b]++;
    }
    const x = Array.from({ length: n }, (_, i) => +(i * width * 1000).toFixed(3));
    return Object.entries(byCat).map(([c, y]) => ({
      type: "scatter", mode: "lines", stackgroup: "one", name: CATEGORY_LABEL[c as Category], x, y,
      line: { color: CATEGORY_COLORS[c as Category], width: 1.5 }, hovertemplate: `${c}: %{y}<extra>+%{x} ms</extra>`,
    }));
  }, [events]);
  if (!data) return <div className="py-16 text-center text-sm text-muted">Waiting for events…</div>;
  return <Chart height={260} data={data} layout={{ xaxis: { title: { text: "ms since first call" } }, showlegend: true }} />;
}
