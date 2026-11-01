import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui";
import { useTrace } from "../context/TraceContext";
import { ERRNO_HELP } from "../lib/format";
import { CATALOG_CATEGORIES, SYSCALLS, type CatalogCategory } from "../lib/syscallCatalog";

const CAT_COLOR: Record<CatalogCategory, string> = {
  "File operations": "#1558C9", "Process operations": "#D4FF24", "Memory operations": "#6A9BF0", "Other operations": "#9299A8",
};

// glibc wrappers that appear under a different name in traces
const ALIASES: Record<string, string[]> = {
  open: ["open", "openat"], fork: ["fork", "clone", "clone3", "vfork"], stat: ["stat", "newfstatat", "statx", "lstat", "fstat"],
  exit: ["exit"], wait4: ["wait4", "waitid"],
};

export default function SyscallExplorer() {
  const { events, activeId } = useTrace();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CatalogCategory | "all">("all");
  const [sel, setSel] = useState("openat");

  const seen = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of events) if (e.kind === "syscall") m[e.name] = (m[e.name] ?? 0) + 1;
    return m;
  }, [events]);
  const countFor = (n: string) => (ALIASES[n] ?? [n]).reduce((a, x) => a + (seen[x] ?? 0), 0);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return SYSCALLS.filter((d) => (cat === "all" || d.category === cat) &&
      (!s || d.name.includes(s) || d.purpose.toLowerCase().includes(s) || d.description.toLowerCase().includes(s)));
  }, [q, cat]);
  const doc = SYSCALLS.find((d) => d.name === sel) ?? list[0];

  return (
    <div>
      <PageHeader title="System call explorer" description="A reference for the calls you will see most often in traces. Counts show how often each appeared in the selected trace." />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search by name or purpose" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search system calls" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...CATALOG_CATEGORIES] as const).map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
              className={`rounded-lg border px-3 py-2 text-xs transition-colors ${cat === c ? "border-cobalt bg-cobalt/15 text-fog" : "border-line text-muted hover:text-fog"}`}>
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <ul className="panel max-h-[70vh] overflow-y-auto p-1.5" aria-label="System calls">
          {list.length === 0 && <li className="p-4 text-sm text-muted">No calls match “{q}”.</li>}
          {list.map((d) => (
            <li key={d.name}>
              <button onClick={() => setSel(d.name)} aria-current={doc?.name === d.name}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${doc?.name === d.name ? "bg-cobalt/15" : "hover:bg-white/[0.04]"}`}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CAT_COLOR[d.category] }} />
                <span className="flex-1 font-mono text-sm">{d.name}()</span>
                {activeId && countFor(d.name) > 0 && <span className="rounded bg-lime/10 px-1.5 font-mono text-[11px] text-lime">{countFor(d.name)}</span>}
              </button>
            </li>
          ))}
        </ul>

        <AnimatePresence mode="wait">
          {doc && (
            <motion.article key={doc.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} className="panel p-6 lg:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-mono text-3xl tracking-tight">{doc.name}()</h2>
                <span className="rounded-md px-2 py-0.5 text-xs" style={{ color: CAT_COLOR[doc.category], background: `${CAT_COLOR[doc.category]}1a` }}>{doc.category}</span>
                {activeId && <span className="chip">{countFor(doc.name)} in selected trace</span>}
              </div>
              <p className="mt-3 text-lg text-fog/90">{doc.purpose}</p>
              <pre className="mt-5 overflow-x-auto rounded-lg border border-line bg-ink p-4 font-mono text-[13px] text-cobalt-300">{doc.signature}</pre>
              <p className="mt-5 max-w-[72ch] leading-relaxed text-fog/85">{doc.description}</p>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <div>
                  <h3 className="label">Arguments</h3>
                  {doc.args.length === 0 ? <p className="text-sm text-muted">Takes no arguments.</p> : (
                    <dl className="divide-y divide-line rounded-lg border border-line">
                      {doc.args.map((a) => (
                        <div key={a.name} className="grid grid-cols-[110px_1fr] gap-3 px-3 py-2.5 text-sm">
                          <dt className="font-mono text-cobalt-300">{a.name}</dt><dd className="text-fog/85">{a.desc}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
                <div className="space-y-5">
                  <div>
                    <h3 className="label">Example as seen in strace</h3>
                    <code className="block overflow-x-auto rounded-lg border border-line bg-ink px-3 py-2.5 font-mono text-[12.5px] text-lime">{doc.example}</code>
                  </div>
                  <div>
                    <h3 className="label">Return value</h3>
                    <p className="text-sm text-fog/85">{doc.returns}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <div>
                  <h3 className="label">Common error codes</h3>
                  {doc.errors.length === 0 ? <p className="text-sm text-muted">This call cannot fail.</p> : (
                    <ul className="space-y-1.5">
                      {doc.errors.map((e) => (
                        <li key={e} className="flex gap-3 text-sm"><span className="w-28 shrink-0 font-mono text-danger">{e}</span><span className="text-muted">{ERRNO_HELP[e] ?? ""}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="label">Real-world usage</h3>
                  <p className="text-sm leading-relaxed text-fog/85">{doc.usage}</p>
                </div>
              </div>
            </motion.article>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
