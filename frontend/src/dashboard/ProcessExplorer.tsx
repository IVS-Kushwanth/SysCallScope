import { Background as FlowBg, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AnimatePresence, motion } from "framer-motion";
import { GitBranch, Info, X } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { EventDetail } from "../components/EventDetail";
import { NoSession } from "../components/NoSession";
import { DemoBadge, PageHeader, Panel, Skeleton, StatusPill } from "../components/ui";
import { useAnalysis, useTrace } from "../context/TraceContext";
import { fmtDuration, fmtRelMs, truncate } from "../lib/format";
import { api } from "../services/api";
import type { ProcessInfo, TraceEvent } from "../services/types";

const STATE_COLOR: Record<ProcessInfo["state"], string> = {
  created: "#9299A8", running: "#D4FF24", waiting: "#FFB547", terminated: "#6A9BF0", failed: "#FF5252",
};

function base(p: string | null) {
  return p ? p.split("/").pop() : "unknown";
}

type PNode = Node<{ p: ProcessInfo; selected: boolean; root: boolean }, "proc">;

const ProcNode = memo(({ data }: NodeProps<PNode>) => {
  const { p, selected, root } = data;
  const c = STATE_COLOR[p.state];
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}
      className={`w-[230px] rounded-xl border bg-card px-4 py-3 text-left shadow-xl transition-colors ${selected ? "border-lime" : "border-line hover:border-cobalt"}`}
      style={{ boxShadow: selected ? "0 0 0 1px #D4FF24, 0 0 30px -8px rgba(212,255,36,.5)" : undefined }}>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-cobalt" />
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-fog">PID {p.pid}</span>
        <span className="flex items-center gap-1.5 font-mono text-[10.5px]" style={{ color: c }}>
          <span className={`h-2 w-2 rounded-full ${p.state === "running" || p.state === "waiting" ? "animate-pulseDot" : ""}`} style={{ background: c }} />
          {p.state}{p.state_basis === "inferred" ? "*" : ""}
        </span>
      </div>
      <div className="mt-1 truncate font-mono text-[12px] text-cobalt-300" title={p.program ?? ""}>{base(p.program)}{p.inherited_program ? " (forked copy)" : ""}</div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>{root ? "traced root" : `via ${p.created_by}()`}</span>
        <span>{p.syscall_count} calls{p.failed_count ? <span className="text-danger"> · {p.failed_count} failed</span> : null}</span>
      </div>
      {(p.exit_code != null || p.signal) && (
        <div className="mt-1.5 text-[11px]" style={{ color: p.signal || p.exit_code ? "#FF5252" : "#6A9BF0" }}>
          {p.signal ? `killed by ${p.signal}` : `exit_group → status ${p.exit_code}`}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-cobalt" />
    </motion.div>
  );
});

const nodeTypes = { proc: ProcNode };

function layout(procs: ProcessInfo[], roots: number[]) {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const pos = new Map<number, { x: number; y: number }>();
  let cursor = 0;
  const W = 270, H = 170;
  const visit = (pid: number, depth: number): number => {
    const p = byPid.get(pid);
    const kids = (p?.children ?? []).filter((k) => byPid.has(k));
    if (!kids.length) {
      const x = cursor++ * W;
      pos.set(pid, { x, y: depth * H });
      return x;
    }
    const xs = kids.map((k) => visit(k, depth + 1));
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    pos.set(pid, { x, y: depth * H });
    return x;
  };
  roots.forEach((r) => visit(r, 0));
  return pos;
}

export default function ProcessExplorer() {
  const { activeId, events, isRunning, mode } = useTrace();
  const { data: tree, loading } = useAnalysis(api.processes);
  const [sel, setSel] = useState<number | null>(null);
  const [evt, setEvt] = useState<TraceEvent | null>(null);

  const { nodes, edges } = useMemo(() => {
    if (!tree) return { nodes: [] as PNode[], edges: [] as Edge[] };
    const pos = layout(tree.processes, tree.roots);
    const nodes: PNode[] = tree.processes.map((p) => ({
      id: String(p.pid), type: "proc", position: pos.get(p.pid) ?? { x: 0, y: 0 },
      data: { p, selected: sel === p.pid, root: tree.roots.includes(p.pid) },
    }));
    const edges: Edge[] = tree.processes.filter((p) => p.ppid != null && tree.processes.some((x) => x.pid === p.ppid)).map((p) => ({
      id: `${p.ppid}-${p.pid}`, source: String(p.ppid), target: String(p.pid),
      label: `${p.created_by}()`, animated: p.state === "running" || p.state === "waiting" || isRunning,
      style: { stroke: "#1558C9", strokeWidth: 1.6 },
      labelStyle: { fill: "#D4FF24", fontFamily: "IBM Plex Mono", fontSize: 11 },
      labelBgStyle: { fill: "#030407" }, labelBgPadding: [6, 3] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: "#1558C9" },
    }));
    return { nodes, edges };
  }, [tree, sel, isRunning]);

  const selected = tree?.processes.find((p) => p.pid === sel) ?? null;
  const related = useMemo(() => (sel == null ? [] : events.filter((e) => e.pid === sel)), [events, sel]);
  const t0 = events[0]?.ts ?? 0;

  if (!activeId) return (<><PageHeader title="Process explorer" /><NoSession what="The process tree" /></>);

  const lifecycle = selected ? buildLifecycle(selected, related, tree!.processes) : [];

  return (
    <div>
      <PageHeader title="Process explorer" description="Processes reconstructed from clone/fork return values, execve calls and exit lines in the trace. Click a process to inspect it."
        actions={<>{mode === "demo" && <DemoBadge />}{tree && <span className="chip">{tree.count} processes{tree.threads ? `, ${tree.threads} threads` : ""}</span>}</>} />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="panel relative h-[620px] overflow-hidden p-0">
          {loading || !tree ? <Skeleton className="m-6 h-[560px]" /> : (
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.3, maxZoom: 1.1 }}
              onNodeClick={(_, n) => setSel(Number(n.id))} onPaneClick={() => setSel(null)} nodesDraggable proOptions={{ hideAttribution: true }}
              minZoom={0.2} colorMode="dark" style={{ background: "transparent" }}>
              <FlowBg color="rgba(255,255,255,0.06)" gap={24} />
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>
          )}
          <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-line bg-ink/80 p-3 text-[11px] backdrop-blur">
            {Object.entries(STATE_COLOR).map(([s, c]) => (
              <div key={s} className="flex items-center gap-2 py-0.5 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{s}</div>
            ))}
            <div className="mt-1.5 border-t border-line pt-1.5 text-muted">* inferred, not observed</div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div key={selected.pid} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="panel flex max-h-[620px] flex-col p-0">
              <div className="flex items-start justify-between border-b border-line p-5">
                <div>
                  <div className="font-mono text-lg">PID {selected.pid}</div>
                  <div className="mt-0.5 break-all font-mono text-xs text-cobalt-300">{selected.program}</div>
                </div>
                <button onClick={() => setSel(null)} className="p-1 text-muted hover:text-fog" aria-label="Close process details"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["Parent PID", selected.ppid ?? "— (traced root)"], ["Created by", selected.created_by ? `${selected.created_by}()` : "strace launch"],
                    ["Created at", fmtRelMs(selected.created_at, t0)], ["Lifetime", fmtDuration((selected.ended_at ?? selected.last_seen) - selected.created_at)],
                    ["State", `${selected.state} (${selected.state_basis})`], ["Exit status", selected.signal ?? selected.exit_code ?? "—"],
                    ["System calls", selected.syscall_count], ["Children", selected.children.join(", ") || "none"],
                  ].map(([k, v]) => (
                    <div key={k as string} className="panel-flat p-2.5"><dt className="text-[11px] text-muted">{k}</dt><dd className="mt-0.5 break-all font-mono text-[12px]">{String(v)}</dd></div>
                  ))}
                </dl>
                <h4 className="mb-2 mt-5 text-xs font-medium text-muted">Lifecycle</h4>
                <ol className="relative space-y-3 border-l border-cobalt/40 pl-4">
                  {lifecycle.map((s, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-ink" style={{ background: s.color }} />
                      <div className="text-sm">{s.label}</div>
                      <div className="font-mono text-[11px] text-muted">{s.detail}</div>
                    </li>
                  ))}
                </ol>
                {selected.state_basis === "inferred" && (
                  <p className="mt-4 flex gap-2 text-xs text-muted"><Info size={14} className="mt-0.5 shrink-0" />strace shows system calls, not scheduler states. This state is inferred from the last observed call.</p>
                )}
                <h4 className="mb-2 mt-5 text-xs font-medium text-muted">Related system calls ({related.length})</h4>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {related.slice(0, 300).map((e) => (
                    <li key={e.seq}>
                      <button onClick={() => setEvt(e)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11.5px] hover:bg-white/5">
                        <span className="w-24 shrink-0 text-muted">{fmtRelMs(e.ts, t0)}</span>
                        <span className="flex-1 truncate">{e.name}</span>
                        <StatusPill status={e.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ) : (
            <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Panel title="How the tree is built">
                <div className="space-y-3 text-sm leading-relaxed text-fog/85">
                  <p><GitBranch size={14} className="mr-1.5 inline text-lime" />A successful <code className="font-mono">clone()</code>, <code className="font-mono">fork()</code> or <code className="font-mono">vfork()</code> returns the child's PID to the parent: that is an observed edge.</p>
                  <p><code className="font-mono">execve()</code> replaces the program inside an existing PID. The node shows the latest program image.</p>
                  <p><code className="font-mono">+++ exited with N +++</code> marks termination; a non-zero status or a fatal signal shows as failed.</p>
                  <p className="text-muted">Running and waiting are inferred from the last observed call while tracing is active. strace cannot see the scheduler's run queue.</p>
                </div>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <EventDetail event={evt} onClose={() => setEvt(null)} />
    </div>
  );
}

function buildLifecycle(p: ProcessInfo, evs: TraceEvent[], all: ProcessInfo[]) {
  const t0 = evs[0]?.ts ?? p.created_at;
  const steps: { label: string; detail: string; color: string; ts: number }[] = [];
  steps.push({ label: p.created_by ? `Created by PID ${p.ppid} with ${p.created_by}()` : "Started by strace", detail: fmtRelMs(p.created_at, t0), color: "#9299A8", ts: p.created_at });
  for (const prog of p.programs) {
    steps.push({ label: prog.ok ? `execve() loaded ${base(prog.path)}` : `execve() of ${base(prog.path)} failed`, detail: truncate(prog.argv, 60), color: prog.ok ? "#1558C9" : "#FF5252", ts: prog.ts });
  }
  for (const e of evs) {
    if (["clone", "fork", "vfork", "clone3"].includes(e.name) && e.status === "success") {
      steps.push({ label: `Spawned child ${e.retval}`, detail: fmtRelMs(e.ts, t0), color: "#D4FF24", ts: e.ts });
    }
    if ((e.name === "wait4" || e.name === "waitid") && e.status !== "failed") {
      steps.push({ label: e.status === "unfinished" ? "Blocked in wait4()" : `Reaped child ${e.ret} with wait4()`, detail: `${fmtRelMs(e.ts, t0)} · waited ${fmtDuration(e.duration)}`, color: "#FFB547", ts: e.ts });
    }
    if (e.kind === "signal") steps.push({ label: `Received ${e.name}`, detail: truncate(e.args, 60), color: "#FFB547", ts: e.ts });
  }
  if (p.ended_at) steps.push({ label: p.signal ? `Killed by ${p.signal}` : `Exited with status ${p.exit_code}`, detail: fmtRelMs(p.ended_at, t0), color: p.state === "failed" ? "#FF5252" : "#6A9BF0", ts: p.ended_at });
  void all;
  return steps.sort((a, b) => a.ts - b.ts);
}
