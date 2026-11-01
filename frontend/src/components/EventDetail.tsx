import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { TraceEvent } from "../services/types";
import { CATEGORY_COLORS, ERRNO_HELP, fmtClock, fmtDuration } from "../lib/format";
import { StatusPill } from "./ui";
import { SYSCALLS } from "../lib/syscallCatalog";

/** Slide-over inspector for one system call. */
export function EventDetail({ event, onClose }: { event: TraceEvent | null; onClose: () => void }) {
  const info = event ? SYSCALLS.find((s) => s.name === event.name) : undefined;
  return (
    <AnimatePresence>
      {event && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog" aria-label={`Details for ${event.name}`}
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[460px] flex-col border-l border-line bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <div className="font-mono text-lg text-fog">{event.name}{event.kind === "syscall" ? "()" : ""}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[event.category] }} />
                  {event.category} · event #{event.seq}
                </div>
              </div>
              <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-fog" aria-label="Close details"><X size={18} /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ["PID", event.pid],
                  ["Status", <StatusPill key="s" status={event.status} />],
                  ["Timestamp", fmtClock(event.ts)],
                  ["Duration", fmtDuration(event.duration)],
                  ["Return", event.ret ?? "—"],
                  ["Kind", event.kind],
                ].map(([k, v]) => (
                  <div key={k as string} className="panel-flat p-3">
                    <dt className="text-[11px] text-muted">{k}</dt>
                    <dd className="mt-1 break-all font-mono text-[13px]">{v}</dd>
                  </div>
                ))}
              </dl>
              {event.errno && (
                <div className="rounded-lg border border-danger/40 bg-danger/10 p-3">
                  <div className="font-mono text-danger">{event.errno} <span className="text-fog/80">({event.error_msg})</span></div>
                  {ERRNO_HELP[event.errno] && <p className="mt-1 text-xs text-fog/80">{ERRNO_HELP[event.errno]}</p>}
                </div>
              )}
              <div>
                <div className="label">Arguments</div>
                <pre className="panel-flat max-h-56 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-[12px] leading-relaxed text-fog/90">{event.args || "(none)"}</pre>
              </div>
              {event.note && (
                <div>
                  <div className="label">strace note</div>
                  <div className="panel-flat p-3 font-mono text-[12px]">{event.note}</div>
                </div>
              )}
              {info && (
                <div className="rounded-lg border border-cobalt/30 bg-cobalt/[0.07] p-4">
                  <div className="text-xs font-medium text-cobalt-300">About {info.name}()</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-fog/90">{info.purpose}</p>
                  <code className="mt-2 block font-mono text-[11px] text-muted">{info.signature}</code>
                </div>
              )}
              {event.status === "unfinished" && (
                <p className="text-xs text-warn">This call never returned in the trace (the process was stopped, killed, or still blocked when tracing ended).</p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
