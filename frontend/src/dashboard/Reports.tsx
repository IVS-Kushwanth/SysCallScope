import { Download, FileJson, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { NoSession } from "../components/NoSession";
import { Chart } from "../components/Plot";
import { Button, DemoBadge, PageHeader, Panel, SessionStatus, Skeleton, StatusPill } from "../components/ui";
import { useAnalysis, useTrace } from "../context/TraceContext";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABEL, fmtClock, fmtDate, fmtDuration, truncate } from "../lib/format";
import { api } from "../services/api";

export default function Reports() {
  const { activeId, session, sessions, setActiveId, refreshSessions, notify, mode } = useTrace();
  const { data: stats, loading } = useAnalysis(api.stats);
  const { data: tree } = useAnalysis(api.processes);
  const [confirm, setConfirm] = useState<string | null>(null);

  const remove = async (id: string) => {
    try {
      await api.deleteTrace(id);
      const list = await refreshSessions();
      if (id === activeId) setActiveId(list[0]?.id ?? null);
      notify({ kind: "info", title: "Trace session deleted" });
    } catch (e: any) {
      notify({ kind: "error", title: "Delete failed", body: e.message });
    }
    setConfirm(null);
  };

  const sessionList = (
    <Panel title="Trace sessions" subtitle={`Stored in SQLite. ${mode === "demo" ? "Demo" : "Live"} sessions only; switch the data source to see the others.`}>
      {sessions.length === 0 ? <p className="text-sm text-muted">No sessions yet.</p> : (
        <ul className="divide-y divide-line">
          {sessions.map((s) => (
            <li key={s.id} className={`flex items-center gap-3 py-2.5 ${s.id === activeId ? "text-fog" : "text-fog/80"}`}>
              <button className="min-w-0 flex-1 text-left" onClick={() => setActiveId(s.id)}>
                <div className="truncate text-sm">{s.name} {s.id === activeId && <span className="ml-1 text-[11px] text-lime">selected</span>}</div>
                <div className="font-mono text-[11px] text-muted">{fmtDate(s.started_at)} · {s.event_count} events · {s.id}</div>
              </button>
              <SessionStatus status={s.status} />
              {confirm === s.id ? (
                <span className="flex gap-1">
                  <Button size="sm" variant="danger" onClick={() => remove(s.id)}>Delete</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Keep</Button>
                </span>
              ) : (
                <button onClick={() => setConfirm(s.id)} className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-danger" aria-label={`Delete session ${s.name}`}><Trash2 size={15} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );

  if (!activeId) return (<><PageHeader title="Analysis and reports" /><div className="space-y-6"><NoSession what="Analysis and exports" />{sessionList}</div></>);
  if (loading || !stats || !session) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;

  const cats = CATEGORIES.filter((c) => stats.by_category[c]);
  const top = stats.per_call.slice(0, 12);

  return (
    <div>
      <PageHeader title="Analysis and reports" description={`Statistics for ${session.name}. Exports include program information, summary, per-call statistics, process lifecycle, failed calls and the timeline.`}
        actions={<>
          {mode === "demo" && <DemoBadge />}
          <a href={api.exportUrl(session.id, "csv")} download><Button size="sm" variant="secondary" icon={FileSpreadsheet}>CSV</Button></a>
          <a href={api.exportUrl(session.id, "json")} download><Button size="sm" variant="secondary" icon={FileJson}>JSON</Button></a>
          <a href={api.exportUrl(session.id, "pdf")} download><Button size="sm" icon={FileText}>PDF report</Button></a>
        </>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          ["Total calls", stats.total], ["Failed", stats.failed], ["Avg duration", fmtDuration(stats.avg_duration)], ["Longest", fmtDuration(stats.longest[0]?.duration)],
          ["Processes created", stats.processes_created], ["File ops", stats.file_ops], ["Memory ops", stats.memory_ops], ["Signals", stats.signals],
        ].map(([k, v]) => (
          <div key={k as string} className="panel-flat px-3 py-3"><div className="text-[11px] text-muted">{k}</div><div className="mt-1 font-mono text-lg">{String(v)}</div></div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="System calls by category">
          <Chart height={280} data={[{ type: "pie", hole: 0.55, labels: cats.map((c) => CATEGORY_LABEL[c]), values: cats.map((c) => stats.by_category[c]),
            marker: { colors: cats.map((c) => CATEGORY_COLORS[c]), line: { color: "#030407", width: 2 } }, textinfo: "label+percent", textfont: { color: "#030407" } }]}
            layout={{ showlegend: false, margin: { t: 10, b: 10, l: 10, r: 10 } }} />
        </Panel>
        <Panel title="Time spent per call" subtitle="Total time inside each call type, from strace -T">
          <Chart height={280} data={[{ type: "bar", orientation: "h", y: [...top].sort((a, b) => a.total_time - b.total_time).map((c) => c.name),
            x: [...top].sort((a, b) => a.total_time - b.total_time).map((c) => c.total_time * 1000), marker: { color: "#1558C9" }, hovertemplate: "%{y}: %{x:.3f} ms<extra></extra>" }]}
            layout={{ margin: { l: 110 }, xaxis: { title: { text: "ms" } }, yaxis: { tickfont: { family: "IBM Plex Mono", color: "#F5F7FA" } } }} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Most frequently used calls">
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="table-head"><tr><th>Call</th><th>Count</th><th>Failed</th><th>Avg</th><th>Max</th><th>Total</th></tr></thead>
              <tbody>
                {stats.per_call.map((c) => (
                  <tr key={c.name} className="table-row">
                    <td className="font-mono text-xs"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLORS[c.category] }} />{c.name}</td>
                    <td className="font-mono text-xs">{c.count}</td>
                    <td className={`font-mono text-xs ${c.failed ? "text-danger" : "text-muted"}`}>{c.failed}</td>
                    <td className="font-mono text-xs">{fmtDuration(c.avg_time)}</td>
                    <td className="font-mono text-xs">{fmtDuration(c.max_time)}</td>
                    <td className="font-mono text-xs">{fmtDuration(c.total_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Longest system calls" subtitle="Blocking calls such as wait4 and read on a pipe usually top this list">
          <ul className="divide-y divide-line">
            {stats.longest.map((e) => (
              <li key={e.seq} className="flex items-center gap-3 py-2 font-mono text-xs">
                <span className="w-16 shrink-0 text-muted">PID {e.pid}</span>
                <span className="w-24 shrink-0">{e.name}</span>
                <span className="flex-1 truncate text-fog/50">{truncate(e.args, 60)}</span>
                <span className="text-lime">{fmtDuration(e.duration)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Failed system calls" subtitle={stats.failed ? `${stats.failed} failures across ${Object.keys(stats.errno_counts).length} error codes` : "No failures"}>
          <div className="mb-3 flex flex-wrap gap-1.5">{Object.entries(stats.errno_counts).map(([k, v]) => <span key={k} className="chip border-danger/30 text-danger">{k} × {v}</span>)}</div>
          <ul className="max-h-[300px] divide-y divide-line overflow-auto">
            {stats.failed_calls.map((e) => (
              <li key={e.seq} className="py-2 font-mono text-xs">
                <div className="flex gap-3"><span className="text-muted">{fmtClock(e.ts)}</span><span>PID {e.pid}</span><span className="text-fog">{e.name}</span><span className="ml-auto text-danger">{e.errno}</span></div>
                <div className="mt-0.5 truncate text-fog/50">{e.args}</div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Process lifecycle summary">
          <table className="w-full text-sm">
            <thead className="table-head"><tr><th>PID</th><th>Parent</th><th>Program</th><th>State</th><th>Exit</th><th>Calls</th></tr></thead>
            <tbody>
              {(tree?.processes ?? []).map((p) => (
                <tr key={p.pid} className="table-row">
                  <td className="font-mono text-xs">{p.pid}</td>
                  <td className="font-mono text-xs text-muted">{p.ppid ?? "—"}</td>
                  <td className="max-w-[180px] truncate font-mono text-xs text-cobalt-300" title={p.program ?? ""}>{p.program?.split("/").pop()}</td>
                  <td><StatusPill status={p.state === "terminated" ? "exit" : p.state === "failed" ? "failed" : "interrupted"} /> <span className="text-[10px] text-muted">{p.state}</span></td>
                  <td className="font-mono text-xs">{p.signal ?? p.exit_code ?? "—"}</td>
                  <td className="font-mono text-xs">{p.syscall_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="mt-6">{sessionList}</div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted"><Download size={13} />Exports are generated by the backend from the stored events, so they always match what the dashboard shows.</p>
    </div>
  );
}
