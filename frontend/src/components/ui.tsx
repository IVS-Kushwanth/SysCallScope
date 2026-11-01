import { AnimatePresence, motion, useInView, animate } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useTrace } from "../context/TraceContext";
import type { EventStatus } from "../services/types";
import { STATUS_COLORS } from "../lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "lime";

export function Button({
  variant = "primary", size = "md", icon: Icon, children, className = "", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; icon?: LucideIcon }) {
  const v: Record<Variant, string> = {
    primary: "bg-cobalt text-white hover:bg-cobalt-400 shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]",
    secondary: "border border-line bg-white/[0.03] text-fog hover:bg-white/[0.07] hover:border-white/20",
    ghost: "text-muted hover:text-fog hover:bg-white/[0.05]",
    danger: "bg-danger/90 text-white hover:bg-danger",
    lime: "bg-lime text-ink hover:bg-[#e2ff6a] font-semibold",
  };
  const s = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-[15px] gap-2.5" }[size];
  return (
    <button
      {...rest}
      className={`inline-flex select-none items-center justify-center rounded-lg font-medium transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${v[variant]} ${s} ${className}`}
    >
      {Icon && <Icon size={size === "sm" ? 14 : 16} strokeWidth={2} />}
      {children}
    </button>
  );
}

export function Panel({ children, className = "", title, action, subtitle }: {
  children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; subtitle?: ReactNode;
}) {
  return (
    <section className={`panel p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-[15px] font-semibold text-fog">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: EventStatus | string }) {
  const color = STATUS_COLORS[status as EventStatus] ?? "#9299A8";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px]"
      style={{ color, background: `${color}14`, border: `1px solid ${color}33` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

export function SessionStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "#D4FF24", completed: "#6A9BF0", stopped: "#9299A8", failed: "#FF5252", timeout: "#FFB547",
  };
  const c = map[status] ?? "#9299A8";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: c }}>
      <span className={`h-2 w-2 rounded-full ${status === "running" ? "animate-pulseDot" : ""}`} style={{ background: c }} />
      {status}
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-lime/30 bg-lime/10 px-2 py-1 font-mono text-[11px] font-semibold text-lime">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
      </span>
      LIVE
    </span>
  );
}

export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border border-warn/40 bg-warn/10 px-2 py-1 font-mono text-[11px] font-semibold text-warn ${className}`}
      title="Generated sample trace. Not captured from a real process.">
      DEMO DATA
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.05] ${className}`} />;
}

export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString() }: {
  value: number; format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const prev = useRef(0);
  const fmt = useRef(format);
  fmt.current = format;
  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    const from = prev.current;
    prev.current = value;
    const controls = animate(from, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (node.textContent = fmt.current(v)),
      onComplete: () => (node.textContent = fmt.current(value)),
    });
    return () => {
      controls.stop();
      node.textContent = fmt.current(value);
    };
  }, [value, inView]);
  return <span ref={ref}>{format(0)}</span>;
}

export function StatCard({ label, value, icon: Icon, accent = "cobalt", format, hint, index = 0 }: {
  label: string; value: number; icon: LucideIcon; accent?: "cobalt" | "lime" | "danger" | "muted";
  format?: (n: number) => string; hint?: string; index?: number;
}) {
  const color = { cobalt: "#6A9BF0", lime: "#D4FF24", danger: "#FF5252", muted: "#9299A8" }[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="panel relative overflow-hidden p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="mt-3 font-mono text-[28px] font-medium leading-none tracking-tight text-fog">
        <AnimatedNumber value={value} format={format} />
      </div>
      {hint && <div className="mt-2 text-[11px] text-muted">{hint}</div>}
      <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, ${color}66, transparent)` }} />
    </motion.div>
  );
}

export function EmptyState({ icon: Icon, title, body, children }: {
  icon: LucideIcon; title: string; body: string; children?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-cobalt/40 bg-cobalt/10 text-cobalt-300">
        <Icon size={24} />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useTrace();
  const icon = { success: CheckCircle2, error: AlertTriangle, info: Info };
  const color = { success: "#D4FF24", error: "#FF5252", info: "#6A9BF0" };
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[360px] max-w-[calc(100vw-2.5rem)] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => {
          const I = icon[t.kind];
          return (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }} className="pointer-events-auto flex gap-3 rounded-xl border border-line bg-card/95 p-3.5 shadow-2xl backdrop-blur">
              <I size={18} style={{ color: color[t.kind] }} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t.title}</div>
                {t.body && <div className="mt-0.5 break-words text-xs text-muted">{t.body}</div>}
              </div>
              <button onClick={() => dismissToast(t.id)} className="text-muted hover:text-fog" aria-label="Dismiss notification">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${value === o.value ? "text-fog" : "text-muted hover:text-fog"}`}>
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-md bg-cobalt" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
