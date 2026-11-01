import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Code2, Database, FlaskConical, Play, Plus, ShieldCheck, Terminal, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, PageHeader, Panel, Segmented, Skeleton } from "../components/ui";
import { useTrace } from "../context/TraceContext";
import { api } from "../services/api";
import type { SampleProgram } from "../services/types";

function parseArgs(s: string): string[] {
  // Simple quote-aware splitter; nothing is passed to a shell.
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export default function StartTracing() {
  const { mode, setMode, env, backendUp, refreshSessions, setActiveId, notify, refreshHealth } = useTrace();
  const nav = useNavigate();
  const [programs, setPrograms] = useState<SampleProgram[] | null>(null);
  const [source, setSource] = useState<"sample" | "custom">("sample");
  const [selected, setSelected] = useState<string>("parent_child");
  const [executable, setExecutable] = useState("ls");
  const [args, setArgs] = useState("");
  const [follow, setFollow] = useState(true);
  const [timeout, setTimeoutS] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState<SampleProgram | null>(null);

  useEffect(() => {
    api.programs().then((r) => setPrograms(r.programs)).catch(() => setPrograms([]));
  }, []);

  useEffect(() => {
    const p = programs?.find((x) => x.id === selected);
    if (p && source === "sample") setArgs(p.default_args.join(" "));
  }, [selected, programs, source]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = source === "sample"
        ? { program_id: selected, args: parseArgs(args), follow_forks: follow, timeout }
        : { executable, args: parseArgs(args), follow_forks: follow, timeout };
      const s = await api.startTrace(body);
      await refreshSessions();
      setActiveId(s.id);
      notify({ kind: "info", title: `Tracing ${s.name}`, body: "Events are streaming into Live Trace." });
      nav("/app/live");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runDemo = async (replay: boolean) => {
    setBusy(true);
    try {
      const s = await api.createDemo(replay, 1);
      await refreshSessions();
      setActiveId(s.id);
      notify({ kind: "info", title: replay ? "Replaying demo trace" : "Demo trace loaded", body: "This session is labelled DEMO DATA." });
      nav(replay ? "/app/live" : "/app");
    } catch (e: any) {
      notify({ kind: "error", title: "Demo failed", body: e.message });
    } finally {
      setBusy(false);
    }
  };

  const canTrace = !!env?.tracing_possible;

  return (
    <div>
      <PageHeader title="Start tracing" description="Choose a program to run under strace. SyscallScope launches it, follows its children, and streams every system call it makes."
        actions={<Segmented value={mode} onChange={setMode} options={[{ value: "live", label: "Live Linux tracing" }, { value: "demo", label: "Sample demonstration" }]} />} />

      {mode === "demo" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Replay the demo trace live" subtitle="Streams a pre-written parent/child trace through the same pipeline as a real capture">
            <p className="text-sm leading-relaxed text-muted">The demo trace is written in genuine <code className="font-mono text-fog">strace -f -ttt -T</code> format: dynamic loading, a pipe between two processes, fork and execve, a blocked read that resumes, SIGCHLD delivery, memory mappings and several failed calls. It is stored as a separate DEMO DATA session and never mixed with live traces.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button icon={Zap} disabled={busy || backendUp === false} onClick={() => runDemo(true)}>Replay with live animation</Button>
              <Button variant="secondary" icon={Database} disabled={busy || backendUp === false} onClick={() => runDemo(false)}>Load instantly</Button>
            </div>
          </Panel>
          <Panel title="Want real data?" subtitle="Live tracing works on Ubuntu or WSL2 with strace installed">
            <EnvChecklist />
            <Button className="mt-5" variant="secondary" onClick={() => setMode("live")}>Switch to live tracing</Button>
          </Panel>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <Panel title="Program" action={<Segmented value={source} onChange={setSource} options={[{ value: "sample", label: "Sample programs" }, { value: "custom", label: "Executable" }]} />}>
              {source === "sample" ? (
                programs == null ? <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div> : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {programs.map((p) => (
                      <button key={p.id} onClick={() => setSelected(p.id)} aria-pressed={selected === p.id}
                        className={`group relative rounded-xl border p-4 text-left transition-all ${selected === p.id ? "border-cobalt bg-cobalt/10 shadow-[0_0_30px_-12px_rgba(21,88,201,0.9)]" : "border-line bg-surface hover:border-white/20"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{p.name}</span>
                          {selected === p.id ? <Check size={16} className="text-lime" /> : !p.compiled && <span className="text-[11px] text-warn">not compiled</span>}
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted">{p.description}</p>
                        <div className="mt-3 flex flex-wrap gap-1">{p.focus.map((f) => <span key={f} className="chip">{f}</span>)}</div>
                        <span role="link" tabIndex={0} onClick={(e) => { e.stopPropagation(); setShowSource(p); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setShowSource(p); } }}
                          className="mt-3 inline-flex items-center gap-1 text-[11px] text-cobalt-300 hover:text-fog"><Code2 size={12} />View source</span>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div>
                  <label className="label" htmlFor="exe">Executable or command name</label>
                  <input id="exe" className="input font-mono" value={executable} onChange={(e) => setExecutable(e.target.value)} placeholder="ls" />
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Allowed: programs in <span className="font-mono">sample_programs/bin</span>, directories listed in <span className="font-mono">SYSCALLSCOPE_ALLOWED_DIRS</span>, and these utilities:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">{env?.allowed_system_commands.map((c) => (
                    <button key={c} onClick={() => setExecutable(c)} className="chip hover:border-cobalt hover:text-fog">{c}</button>
                  ))}</div>
                </div>
              )}
              <div className="mt-5">
                <label className="label" htmlFor="args">Arguments</label>
                <input id="args" className="input font-mono" value={args} onChange={(e) => setArgs(e.target.value)} placeholder="e.g. sample.txt" />
                <p className="mt-1.5 text-[11px] text-muted">Passed as a list, never through a shell. Relative paths resolve inside the session's own workspace folder, which contains a copy of sample.txt.</p>
              </div>
            </Panel>

            <Panel title="Tracing options">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="mt-1 h-4 w-4 accent-[#1558C9]" />
                  <span><span className="text-sm">Follow child processes</span><span className="block text-xs text-muted">Adds <span className="font-mono">-f</span> so forked children are traced too.</span></span>
                </label>
                <div>
                  <label className="label" htmlFor="timeout">Timeout: {timeout}s</label>
                  <input id="timeout" type="range" min={2} max={60} value={timeout} onChange={(e) => setTimeoutS(+e.target.value)} className="w-full accent-[#1558C9]" />
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-line bg-ink p-3 font-mono text-[12px] text-cobalt-300">
                $ strace {follow ? "-f " : ""}-ttt -T -s 64 -o trace.log -- {source === "sample" ? `sample_programs/bin/${selected}` : executable} {args}
              </div>
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mt-4 flex gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span className="text-fog/90">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button size="lg" icon={Play} disabled={busy || !canTrace} onClick={start}>{busy ? "Starting…" : "Start tracing"}</Button>
                {!canTrace && <span className="text-xs text-warn">Live tracing is unavailable here. See the checklist, or switch to the sample demonstration.</span>}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Environment" action={<Button size="sm" variant="ghost" onClick={refreshHealth}>Recheck</Button>}>
              <EnvChecklist />
            </Panel>
            <Panel title="Safety rules" subtitle="Enforced by the backend for every trace">
              <ul className="space-y-2.5 text-[13px] text-fog/85">
                {["No shell: argument arrays only", "Approved executables only", "No '..' or outside absolute paths", `Timeout and size limits`, "Own process group; Stop kills everything", "Backend refuses to run as root"].map((t) => (
                  <li key={t} className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-lime" />{t}</li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showSource && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSource(null)}>
            <motion.div initial={{ scale: 0.97, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97 }} onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-line bg-surface" role="dialog" aria-label={`${showSource.source} source code`}>
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <span className="font-mono text-sm">sample_programs/{showSource.source}</span>
                <button onClick={() => setShowSource(null)} className="p-1 text-muted hover:text-fog" aria-label="Close"><X size={18} /></button>
              </div>
              <pre className="overflow-auto p-5 font-mono text-[12.5px] leading-relaxed text-fog/90">{showSource.source_code || "Source not found."}</pre>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EnvChecklist() {
  const { env, backendUp } = useTrace();
  if (backendUp === false) return <p className="text-sm text-danger">Backend offline. Start it with <span className="font-mono">uvicorn main:app --port 8000</span> in backend/.</p>;
  if (!env) return <Skeleton className="h-32" />;
  const rows: [boolean, string, string][] = [
    [env.is_linux, "Linux kernel", env.is_linux ? `${env.is_wsl ? "WSL2, " : ""}${env.kernel}` : `${env.platform}: strace needs Linux. Use WSL2 on Windows.`],
    [env.strace_available, "strace installed", env.strace_version ?? `Install: ${env.install_hint}`],
    [env.ptrace_scope == null || env.ptrace_scope <= 1, "ptrace permitted", env.ptrace_note],
    [env.compiled_samples.length > 0, "Sample programs compiled", env.compiled_samples.length ? `${env.compiled_samples.length} ready` : "Run: make -C sample_programs"],
    [!env.running_as_root, "Not running as root", env.running_as_root ? "Backend is running as root (override flag set). Use a normal user." : "Backend runs as a normal user"],
  ];
  return (
    <ul className="space-y-3">
      {rows.map(([ok, title, detail]) => (
        <li key={title} className="flex gap-3">
          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${ok ? "bg-lime/15 text-lime" : "bg-warn/15 text-warn"}`}>
            {ok ? <Check size={12} /> : <Plus size={12} className="rotate-45" />}
          </span>
          <div className="min-w-0">
            <div className="text-sm">{title}</div>
            <div className="break-words text-xs text-muted">{detail}</div>
          </div>
        </li>
      ))}
      <li className="flex gap-3 pt-1 text-xs text-muted"><Terminal size={14} className="mt-0.5 shrink-0" />Ubuntu default ptrace_scope=1 allows tracing programs you start, which is how SyscallScope works.</li>
      <li className="flex gap-3 text-xs text-muted"><FlaskConical size={14} className="mt-0.5 shrink-0" />Docker needs --cap-add=SYS_PTRACE.</li>
    </ul>
  );
}
