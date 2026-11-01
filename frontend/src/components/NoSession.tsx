import { Database, Play, Radar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTrace } from "../context/TraceContext";
import { api } from "../services/api";
import { Button, EmptyState } from "./ui";

/** Shown by every analysis page when no session is selected. */
export function NoSession({ what }: { what: string }) {
  const nav = useNavigate();
  const { mode, setMode, refreshSessions, setActiveId, notify, backendUp } = useTrace();
  const [busy, setBusy] = useState(false);

  const loadDemo = async () => {
    setBusy(true);
    try {
      if (mode !== "demo") setMode("demo");
      const s = await api.createDemo(false);
      await refreshSessions();
      setActiveId(s.id);
      notify({ kind: "info", title: "Demo trace loaded", body: "Sample data is labelled DEMO DATA throughout the dashboard." });
    } catch (e: any) {
      notify({ kind: "error", title: "Could not load demo data", body: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (backendUp === false) {
    return (
      <EmptyState icon={Database} title="Backend not reachable"
        body="The dashboard reads every chart from the FastAPI backend. Start it from the backend folder with: uvicorn main:app --port 8000">
        <Button variant="secondary" onClick={() => window.location.reload()}>Retry connection</Button>
      </EmptyState>
    );
  }
  return (
    <EmptyState icon={Radar} title={`No trace selected`}
      body={`${what} appears here once a trace exists. Capture a real trace on Linux, or load the clearly labelled sample trace to explore the dashboard.`}>
      <Button icon={Play} onClick={() => nav("/app/trace")}>Start tracing</Button>
      <Button variant="secondary" icon={Database} disabled={busy} onClick={loadDemo}>{busy ? "Loading…" : "Use sample data"}</Button>
    </EmptyState>
  );
}
