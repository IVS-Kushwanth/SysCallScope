import { ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, PageHeader, Panel, Segmented, Skeleton } from "../components/ui";
import { useTrace } from "../context/TraceContext";
import { api, API_BASE } from "../services/api";

export default function Settings() {
  const { mode, setMode, env, backendUp, refreshHealth, notify, refreshSessions, setActiveId } = useTrace();
  const [clearing, setClearing] = useState(false);

  const clearDemo = async () => {
    setClearing(true);
    try {
      const { sessions } = await api.sessions("demo");
      await Promise.all(sessions.map((s) => api.deleteTrace(s.id)));
      if (mode === "demo") setActiveId(null);
      await refreshSessions();
      notify({ kind: "success", title: `Removed ${sessions.length} demo session${sessions.length === 1 ? "" : "s"}` });
    } catch (e: any) {
      notify({ kind: "error", title: "Could not clear demo sessions", body: e.message });
    }
    setClearing(false);
  };

  const row = (k: string, v: ReactNode) => (
    <div className="grid grid-cols-[180px_1fr] gap-4 border-t border-line py-2.5 text-sm first:border-t-0">
      <dt className="text-muted">{k}</dt><dd className="break-all font-mono text-[12.5px]">{v}</dd>
    </div>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" description="Data source, environment status and the safety limits enforced by the backend." />
      <div className="space-y-6">
        <Panel title="Data source" subtitle="Live and demo sessions are stored and shown separately; they are never mixed in one view.">
          <Segmented value={mode} onChange={setMode} options={[{ value: "live", label: "Live Linux tracing" }, { value: "demo", label: "Sample demonstration" }]} />
          <p className="mt-3 text-sm text-muted">{mode === "live" ? "Charts show traces captured with strace on this machine." : "Charts show the generated sample trace, marked DEMO DATA."}</p>
          <div className="mt-4 border-t border-line pt-4">
            <Button variant="secondary" size="sm" icon={Trash2} disabled={clearing} onClick={clearDemo}>Delete all demo sessions</Button>
          </div>
        </Panel>

        <Panel title="Linux environment" action={<Button size="sm" variant="ghost" icon={RefreshCw} onClick={refreshHealth}>Recheck</Button>}>
          {backendUp === false ? <p className="text-sm text-danger">Backend not reachable at {API_BASE || "this origin (/api via Vite proxy)"}.</p> : !env ? <Skeleton className="h-48" /> : (
            <dl>
              {row("Platform", `${env.platform} ${env.kernel}${env.is_wsl ? " (WSL2)" : ""}`)}
              {row("strace", env.strace_available ? `${env.strace_version} at ${env.strace_path}` : <span className="text-warn">not installed: {env.install_hint}</span>)}
              {row("ptrace_scope", env.ptrace_scope ?? "not present")}
              {row("ptrace", <span className="font-sans text-fog/85">{env.ptrace_note}</span>)}
              {row("Live tracing", env.tracing_possible ? <span className="text-lime">available</span> : <span className="text-warn">unavailable</span>)}
              {row("Compiled samples", env.compiled_samples.join(", ") || "none: run make -C sample_programs")}
              {row("Allowed directories", env.allowed_dirs.join(", "))}
              {row("Allowed utilities", env.allowed_system_commands.join(", "))}
              {row("API base", API_BASE || "/api (proxied by Vite to 127.0.0.1:8000)")}
            </dl>
          )}
        </Panel>

        <Panel title="Safety limits" subtitle="Configured with environment variables when starting the backend">
          <dl>
            {row("SYSCALLSCOPE_TIMEOUT", "default trace timeout in seconds (15; max 60)")}
            {row("SYSCALLSCOPE_MAX_TRACE_MB", "trace file size limit (25 MB); the run is killed beyond it")}
            {row("SYSCALLSCOPE_MAX_EVENTS", "maximum stored events per session (200,000)")}
            {row("SYSCALLSCOPE_ALLOWED_DIRS", "extra colon-separated directories whose executables may be traced")}
            {row("SYSCALLSCOPE_SYSTEM_COMMANDS", "comma-separated list of approved /usr/bin utilities")}
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            ptrace lets a tracer read and modify another process's memory, which is why Linux restricts it. SyscallScope only traces programs it starts itself, as your normal user, never as root.
          </p>
        </Panel>

        <Panel title="Help">
          <div className="flex flex-wrap gap-3">
            <a href="/docs"><Button variant="secondary" size="sm" icon={ExternalLink}>Documentation</Button></a>
            <a href={`${API_BASE || "http://127.0.0.1:8000"}/docs`} target="_blank" rel="noreferrer"><Button variant="secondary" size="sm" icon={ExternalLink}>API reference (FastAPI)</Button></a>
          </div>
        </Panel>
      </div>
    </div>
  );
}
