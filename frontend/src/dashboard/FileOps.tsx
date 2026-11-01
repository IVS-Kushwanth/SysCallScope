import { AlertOctagon, BookOpen, FileInput, FileOutput, FolderOpen, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { EventDetail } from "../components/EventDetail";
import { NoSession } from "../components/NoSession";
import { Chart } from "../components/Plot";
import { DemoBadge, PageHeader, Panel, Skeleton, StatCard, StatusPill } from "../components/ui";
import { useAnalysis, useTrace } from "../context/TraceContext";
import { ERRNO_HELP, fmtBytes, fmtDuration, fmtRelMs, truncate } from "../lib/format";
import { api } from "../services/api";
import type { FileOp, TraceEvent } from "../services/types";

const OP_COLOR: Record<string, string> = {
  open: "#1558C9", read: "#6A9BF0", write: "#D4FF24", close: "#9299A8", stat: "#7FD1C7", access: "#7FD1C7", unlink: "#FFB547", dup: "#9299A8", pipe: "#FFB547",
};

export default function FileOps() {
  const { activeId, events, mode } = useTrace();
  const { data, loading } = useAnalysis(api.files);
  const [pathFilter, setPathFilter] = useState<string | null>(null);
  const [opFilter, setOpFilter] = useState("");
  const [sel, setSel] = useState<TraceEvent | null>(null);
  const t0 = events[0]?.ts ?? 0;

  const ops = useMemo(() => (data?.operations ?? []).filter((o) => (!pathFilter || o.path === pathFilter) && (!opFilter || o.op === opFilter)), [data, pathFilter, opFilter]);

  if (!activeId) return (<><PageHeader title="File operations" /><NoSession what="File activity" /></>);
  if (loading || !data) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;

  const open = (o: FileOp) => setSel(events.find((e) => e.seq === o.seq) ?? null);
  const realFiles = data.files.filter((f) => !f.path.startsWith("fd ") && !f.path.startsWith("<"));
  const c = data.counts;
  const errs = Object.entries(data.errno_counts);

  return (
    <div>
      <PageHeader title="File operations" description="File-related calls with descriptors resolved back to paths. A descriptor is followed from the openat() that returned it until close(), and children inherit their parent's table at fork."
        actions={mode === "demo" ? <DemoBadge /> : undefined} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard index={0} label="Files opened" value={c.open ?? 0} icon={FolderOpen} />
        <StatCard index={1} label="Reads" value={c.read ?? 0} icon={FileInput} hint={fmtBytes(data.files.reduce((a, f) => a + f.bytes_read, 0)) + " read"} />
        <StatCard index={2} label="Writes" value={c.write ?? 0} icon={FileOutput} accent="lime" hint={fmtBytes(data.files.reduce((a, f) => a + f.bytes_written, 0)) + " written"} />
        <StatCard index={3} label="Closes" value={c.close ?? 0} icon={XCircle} accent="muted" />
        <StatCard index={4} label="Probes (stat/access)" value={(c.stat ?? 0) + (c.access ?? 0)} icon={BookOpen} accent="muted" />
        <StatCard index={5} label="Failed file operations" value={data.failed.length} icon={AlertOctagon} accent="danger" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Files touched" subtitle="Click a row to filter the operation log">
          <div className="max-h-[380px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="table-head"><tr><th>Path</th><th>Open</th><th>Read</th><th>Write</th><th>Bytes</th><th>FDs</th><th>Errors</th></tr></thead>
              <tbody>
                {data.files.map((f) => (
                  <tr key={f.path} onClick={() => setPathFilter(pathFilter === f.path ? null : f.path)}
                    className={`table-row cursor-pointer hover:bg-white/[0.04] ${pathFilter === f.path ? "bg-cobalt/15" : ""}`}>
                    <td className="max-w-[300px] truncate font-mono text-xs" title={f.path}>{f.path}</td>
                    <td className="font-mono text-xs">{f.opens}</td>
                    <td className="font-mono text-xs">{f.reads}</td>
                    <td className="font-mono text-xs">{f.writes}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">{f.bytes_read || f.bytes_written ? `${fmtBytes(f.bytes_read)} / ${fmtBytes(f.bytes_written)}` : "—"}</td>
                    <td className="font-mono text-xs text-cobalt-300">{f.fds.join(", ") || "—"}</td>
                    <td className={`font-mono text-xs ${f.errors ? "text-danger" : "text-muted"}`}>{f.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title="Operations by type">
            <Chart height={200} data={[{ type: "bar", x: Object.keys(c), y: Object.values(c), marker: { color: Object.keys(c).map((k) => OP_COLOR[k] ?? "#9299A8") }, hovertemplate: "%{x}: %{y}<extra></extra>" }]} />
          </Panel>
          <Panel title="Errors" subtitle={errs.length ? undefined : "No file operation failed"}>
            <ul className="space-y-3">
              {errs.map(([code, n]) => (
                <li key={code} className="flex gap-3">
                  <span className="w-20 shrink-0 font-mono text-sm text-danger">{code}</span>
                  <div className="text-xs"><span className="text-fog">{n} call{n > 1 ? "s" : ""}.</span> <span className="text-muted">{ERRNO_HELP[code] ?? ""}</span></div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {realFiles.length > 0 && (
        <Panel className="mt-6" title="Descriptor lifecycle" subtitle="Each bar spans from open to close for one path in one process">
          <DescriptorLanes ops={data.operations} t0={t0} />
        </Panel>
      )}

      <div className="panel mt-6 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h3 className="text-[15px] font-semibold">Operation log{pathFilter && <span className="ml-2 font-mono text-xs text-cobalt-300">{truncate(pathFilter, 50)}</span>}</h3>
          <div className="flex gap-2">
            {pathFilter && <button className="text-xs text-muted hover:text-fog" onClick={() => setPathFilter(null)}>Clear path filter</button>}
            <select className="input h-8 w-auto py-0 text-xs" value={opFilter} onChange={(e) => setOpFilter(e.target.value)} aria-label="Filter by operation">
              <option value="">All operations</option>{Object.keys(c).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="max-h-[460px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="table-head"><tr><th>Time</th><th>PID</th><th>Call</th><th>Path</th><th>FD</th><th>Mode / bytes</th><th>Status</th><th>Duration</th></tr></thead>
            <tbody>
              {ops.slice(0, 1500).map((o) => (
                <tr key={o.seq} onClick={() => open(o)} className="table-row cursor-pointer hover:bg-white/[0.04]">
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{fmtRelMs(o.ts, t0)}</td>
                  <td className="font-mono text-xs">{o.pid}</td>
                  <td className="whitespace-nowrap font-mono text-xs" style={{ color: OP_COLOR[o.op] }}>{o.syscall}</td>
                  <td className="max-w-[280px] truncate font-mono text-xs" title={o.path}>{o.path}</td>
                  <td className="font-mono text-xs text-cobalt-300">{o.fd ?? "—"}</td>
                  <td className="max-w-[200px] truncate font-mono text-xs text-muted">{o.flags ?? (o.bytes != null ? fmtBytes(o.bytes) : "")}</td>
                  <td>{o.status === "failed" ? <span className="font-mono text-xs text-danger">{o.errno}</span> : <StatusPill status={o.status} />}</td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{fmtDuration(o.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <EventDetail event={sel} onClose={() => setSel(null)} />
    </div>
  );
}

function DescriptorLanes({ ops, t0 }: { ops: FileOp[]; t0: number }) {
  const lanes = useMemo(() => {
    const out: { label: string; start: number; end: number; reads: number; writes: number }[] = [];
    const openMap = new Map<string, (typeof out)[number]>();
    const last = ops.length ? ops[ops.length - 1].ts : t0;
    for (const o of ops) {
      const key = `${o.pid}:${o.fd}`;
      if (o.op === "open" && o.fd != null && o.status === "success") {
        const lane = { label: `${o.path.split("/").pop()} (PID ${o.pid}, fd ${o.fd})`, start: o.ts, end: last, reads: 0, writes: 0 };
        openMap.set(key, lane);
        out.push(lane);
      } else if (openMap.has(key)) {
        const l = openMap.get(key)!;
        if (o.op === "read") l.reads++;
        if (o.op === "write") l.writes++;
        if (o.op === "close") { l.end = o.ts; openMap.delete(key); }
      }
    }
    return out.slice(0, 40);
  }, [ops, t0]);
  if (!lanes.length) return <p className="text-sm text-muted">No successful opens to show.</p>;
  return (
    <Chart height={Math.max(180, 40 + lanes.length * 26)}
      data={[{
        type: "bar", orientation: "h", y: lanes.map((l) => l.label), base: lanes.map((l) => (l.start - t0) * 1000),
        x: lanes.map((l) => Math.max((l.end - l.start) * 1000, 0.002)),
        marker: { color: lanes.map((l) => (l.writes ? "#D4FF24" : "#1558C9")) },
        text: lanes.map((l) => `${l.reads} reads, ${l.writes} writes`), hovertemplate: "%{y}<br>%{text}<br>open for %{x:.3f} ms<extra></extra>",
      }]}
      layout={{ margin: { l: 260 }, yaxis: { autorange: "reversed", tickfont: { family: "IBM Plex Mono", size: 10, color: "#F5F7FA" } }, xaxis: { title: { text: "ms since first event" } } }} />
  );
}
