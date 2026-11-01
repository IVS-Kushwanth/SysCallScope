import { AlertOctagon, ArrowUpFromLine, Info, Layers, MemoryStick, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { EventDetail } from "../components/EventDetail";
import { NoSession } from "../components/NoSession";
import { Chart } from "../components/Plot";
import { DemoBadge, PageHeader, Panel, Skeleton, StatCard, StatusPill } from "../components/ui";
import { useAnalysis, useTrace } from "../context/TraceContext";
import { fmtBytes, fmtDuration, fmtHex, fmtRelMs, truncate } from "../lib/format";
import { api } from "../services/api";
import type { MemRegion, TraceEvent } from "../services/types";

function protColor(prot: string) {
  if (prot.includes("PROT_EXEC")) return "#1558C9";
  if (prot.includes("PROT_WRITE")) return "#D4FF24";
  if (prot.includes("PROT_NONE")) return "#FF5252";
  return "#6A9BF0";
}
function protShort(prot: string) {
  if (prot.includes("PROT_NONE")) return "---";
  return `${prot.includes("READ") ? "r" : "-"}${prot.includes("WRITE") ? "w" : "-"}${prot.includes("EXEC") ? "x" : "-"}`;
}

export default function Memory() {
  const { activeId, events, mode } = useTrace();
  const { data, loading } = useAnalysis(api.memory);
  const [hover, setHover] = useState<MemRegion | null>(null);
  const [sel, setSel] = useState<TraceEvent | null>(null);
  const [showUnmapped, setShowUnmapped] = useState(true);
  const t0 = events[0]?.ts ?? 0;

  const byPid = useMemo(() => {
    const m = new Map<number, MemRegion[]>();
    for (const r of data?.regions ?? []) {
      if (!showUnmapped && !r.active) continue;
      (m.get(r.pid) ?? m.set(r.pid, []).get(r.pid)!).push(r);
    }
    for (const list of m.values()) list.sort((a, b) => a.start - b.start);
    return [...m.entries()];
  }, [data, showUnmapped]);

  if (!activeId) return (<><PageHeader title="Memory analysis" /><NoSession what="Memory activity" /></>);
  if (loading || !data) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;

  const c = data.counts;
  const sizes = data.operations.filter((o) => o.op === "map" && o.status === "success");

  return (
    <div>
      <PageHeader title="Memory analysis" description="Virtual memory requests made through mmap, munmap, brk and mprotect, and the address-space regions they describe."
        actions={mode === "demo" ? <DemoBadge /> : undefined} />

      <div className="mb-6 flex gap-3 rounded-xl border border-cobalt/30 bg-cobalt/[0.07] p-4 text-sm leading-relaxed text-fog/85">
        <Info size={18} className="mt-0.5 shrink-0 text-cobalt-300" />
        <p>strace sees the <b>requests</b> a program makes to the kernel, not physical memory. Linux allocates physical pages lazily, on first access, so a 1 MiB mmap may use almost no RAM. Allocations served from memory malloc already owns make no system call at all and never appear here.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard index={0} label="mmap calls" value={c.map ?? 0} icon={Layers} />
        <StatCard index={1} label="munmap calls" value={c.unmap ?? 0} icon={MemoryStick} accent="muted" />
        <StatCard index={2} label="mprotect calls" value={c.protect ?? 0} icon={Shield} accent="muted" />
        <StatCard index={3} label="brk calls" value={c.brk ?? 0} icon={ArrowUpFromLine} accent="lime" hint={`heap grew ${fmtBytes(data.heap_growth)}`} />
        <StatCard index={4} label="Bytes mapped" value={data.bytes_mapped} icon={Layers} format={(n) => fmtBytes(n)} hint={`${fmtBytes(data.bytes_unmapped)} unmapped`} />
        <StatCard index={5} label="Failed memory calls" value={data.failed.length} icon={AlertOctagon} accent="danger" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Observed address-space regions" subtitle="Ordered by address; block width grows with the log of the size, so small and huge regions both stay visible"
          action={<label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" className="accent-[#1558C9]" checked={showUnmapped} onChange={(e) => setShowUnmapped(e.target.checked)} />Show unmapped</label>}>
          {byPid.length === 0 && <p className="text-sm text-muted">No successful mappings were observed.</p>}
          <div className="space-y-5">
            {byPid.map(([pid, regions]) => (
              <div key={pid}>
                <div className="mb-1.5 flex items-center justify-between font-mono text-xs text-muted">
                  <span>PID {pid}</span><span>{fmtHex(regions[0].start)} … {fmtHex(regions[regions.length - 1].end)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {regions.map((r, i) => (
                    <button key={i} onMouseEnter={() => setHover(r)} onFocus={() => setHover(r)} onClick={() => setHover(r)}
                      aria-label={`${r.source} ${fmtBytes(r.size)} ${protShort(r.prot)}`}
                      className={`h-12 rounded-md border transition-transform hover:-translate-y-0.5 ${r.active ? "" : "opacity-35"}`}
                      style={{
                        width: `${Math.max(18, Math.log2(Math.max(r.size, 2)) * 5)}px`,
                        background: r.active ? `${protColor(r.prot)}33` : "transparent",
                        borderColor: protColor(r.prot),
                        borderStyle: r.active ? "solid" : "dashed",
                      }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-muted">
            {[["#1558C9", "executable (r-x)"], ["#D4FF24", "writable (rw-)"], ["#6A9BF0", "read-only (r--)"], ["#FF5252", "no access (---)"]].map(([col, l]) => (
              <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: col }} />{l}</span>
            ))}
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-muted" />unmapped later</span>
          </div>
          <div className="mt-4 min-h-[86px] rounded-lg border border-line bg-ink p-3 font-mono text-[12px]">
            {hover ? (
              <>
                <div className="text-fog">{hover.source} <span className="text-muted">({hover.kind === "brk" ? "heap via brk" : "mmap"})</span></div>
                <div className="mt-1 text-muted">{fmtHex(hover.start)} – {fmtHex(hover.end)} · {fmtBytes(hover.size)} · {protShort(hover.prot)}</div>
                <div className="mt-1 truncate text-muted">{hover.flags}</div>
                {!hover.active && <div className="mt-1 text-warn">Removed by munmap</div>}
                {hover.partially_unmapped && <div className="mt-1 text-warn">Partially unmapped</div>}
              </>
            ) : <span className="text-muted">Hover or focus a region to see its addresses, size and protection.</span>}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Where these regions live" subtitle="Typical x86-64 process layout (high addresses at the top)">
            <VmDiagram />
          </Panel>
          <Panel title="Mapping sizes">
            <Chart height={200} data={[{ type: "bar", x: sizes.map((o) => `#${o.seq}`), y: sizes.map((o) => o.size),
              marker: { color: sizes.map((o) => protColor(o.prot ?? "")) }, text: sizes.map((o) => `${o.source} ${fmtBytes(o.size)}`), hovertemplate: "%{text}<extra></extra>" }]}
              layout={{ yaxis: { type: "log", title: { text: "bytes" } }, xaxis: { showticklabels: false } }} />
          </Panel>
        </div>
      </div>

      <div className="panel mt-6 overflow-hidden p-0">
        <div className="border-b border-line px-5 py-3"><h3 className="text-[15px] font-semibold">Memory operations</h3></div>
        <div className="max-h-[460px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="table-head"><tr><th>Time</th><th>PID</th><th>Call</th><th>Address</th><th>Size</th><th>Protection</th><th>Source</th><th>Status</th><th>Duration</th></tr></thead>
            <tbody>
              {data.operations.map((o) => (
                <tr key={o.seq} onClick={() => setSel(events.find((e) => e.seq === o.seq) ?? null)} className="table-row cursor-pointer hover:bg-white/[0.04]">
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{fmtRelMs(o.ts, t0)}</td>
                  <td className="font-mono text-xs">{o.pid}</td>
                  <td className="font-mono text-xs text-cobalt-300">{o.syscall}</td>
                  <td className="font-mono text-xs">{fmtHex(o.addr)}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{o.op === "brk" ? (o.size ? `+${fmtBytes(o.size)}` : "query") : fmtBytes(o.size)}</td>
                  <td className="font-mono text-xs" style={{ color: o.prot ? protColor(o.prot) : undefined }}>{o.prot ? protShort(o.prot) : "—"}</td>
                  <td className="max-w-[220px] truncate font-mono text-xs text-muted" title={o.source}>{truncate(o.source ?? "", 40) || "—"}</td>
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

function VmDiagram() {
  const parts = [
    { name: "Kernel space", note: "not accessible from user mode", color: "#9299A8", h: 30 },
    { name: "Stack", note: "grows down", color: "#6A9BF0", h: 34 },
    { name: "mmap area", note: "shared libraries, large malloc, anonymous mmap", color: "#1558C9", h: 60 },
    { name: "free space", note: "", color: "transparent", h: 28 },
    { name: "Heap", note: "grows up via brk()", color: "#D4FF24", h: 40 },
    { name: "Program text and data", note: "mapped by execve()", color: "#6A9BF0", h: 34 },
  ];
  return (
    <div className="flex gap-3">
      <div className="flex-1 overflow-hidden rounded-lg border border-line">
        {parts.map((p) => (
          <div key={p.name} className="flex items-center justify-between border-b border-line px-3 last:border-b-0"
            style={{ height: p.h, background: p.color === "transparent" ? "repeating-linear-gradient(45deg,transparent 0 6px,rgba(255,255,255,0.03) 6px 12px)" : `${p.color}22` }}>
            <span className="text-xs" style={{ color: p.color === "transparent" ? "#9299A8" : p.color }}>{p.name}</span>
            <span className="text-[10.5px] text-muted">{p.note}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col justify-between py-1 font-mono text-[10px] text-muted"><span>0xffff…</span><span>0x0000…</span></div>
    </div>
  );
}
