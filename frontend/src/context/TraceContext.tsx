import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../services/api";
import type { Environment, Mode, Session, TraceEvent } from "../services/types";

export interface Notice {
  id: number;
  kind: "success" | "error" | "info";
  title: string;
  body?: string;
  at: number;
}

interface TraceState {
  backendUp: boolean | null;
  env: Environment | null;
  refreshHealth: () => Promise<void>;
  mode: Mode;
  setMode: (m: Mode) => void;
  sessions: Session[];
  refreshSessions: () => Promise<Session[]>;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  session: Session | null;
  events: TraceEvent[];
  eventsLoading: boolean;
  /** Increments whenever new data arrives; analysis hooks refetch on change (throttled). */
  version: number;
  isRunning: boolean;
  notify: (n: Omit<Notice, "id" | "at">) => void;
  notices: Notice[];
  toasts: Notice[];
  dismissToast: (id: number) => void;
}

const Ctx = createContext<TraceState | null>(null);

const MODE_KEY = "syscallscope.mode";
const ACTIVE_KEY = "syscallscope.active";

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, v: string | null) {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* storage unavailable */
  }
}

export function TraceProvider({ children }: { children: ReactNode }) {
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [env, setEnv] = useState<Environment | null>(null);
  const [mode, setModeState] = useState<Mode>(() => (readPref(MODE_KEY) as Mode) || "demo");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(() => readPref(ACTIVE_KEY));
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [toasts, setToasts] = useState<Notice[]>([]);
  const idRef = useRef(1);
  const wsRef = useRef<WebSocket | null>(null);
  const bumpTimer = useRef<number | null>(null);

  const notify = useCallback((n: Omit<Notice, "id" | "at">) => {
    const full: Notice = { ...n, id: idRef.current++, at: Date.now() };
    setNotices((p) => [full, ...p].slice(0, 30));
    setToasts((p) => [...p, full]);
    window.setTimeout(() => setToasts((p) => p.filter((t) => t.id !== full.id)), 5200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await api.health();
      setEnv(h.environment);
      setBackendUp(true);
    } catch {
      setBackendUp(false);
      setEnv(null);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const { sessions } = await api.sessions(mode);
      setSessions(sessions);
      return sessions;
    } catch {
      setSessions([]);
      return [];
    }
  }, [mode]);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    writePref(MODE_KEY, m);
    setActiveIdState(null);
    writePref(ACTIVE_KEY, null);
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    writePref(ACTIVE_KEY, id);
  }, []);

  useEffect(() => {
    refreshHealth();
    const t = window.setInterval(refreshHealth, 15000);
    return () => window.clearInterval(t);
  }, [refreshHealth]);

  // Load the session list for the current mode; pick the newest if none is active.
  useEffect(() => {
    if (backendUp === false) return;
    refreshSessions().then((list) => {
      setActiveIdState((cur) => {
        if (cur && list.some((s) => s.id === cur)) return cur;
        const next = list[0]?.id ?? null;
        writePref(ACTIVE_KEY, next);
        return next;
      });
    });
  }, [mode, backendUp, refreshSessions]);

  const bump = useCallback(() => {
    if (bumpTimer.current) return;
    bumpTimer.current = window.setTimeout(() => {
      bumpTimer.current = null;
      setVersion((v) => v + 1);
    }, 900);
  }, []);

  // Load the active session's events; stream new ones while it is running.
  useEffect(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setEvents([]);
    setSession(null);
    if (!activeId) return;
    let cancelled = false;
    setEventsLoading(true);

    (async () => {
      try {
        const s = await api.session(activeId);
        if (cancelled) return;
        if (s.mode !== mode) {
          setActiveId(null);
          return;
        }
        setSession(s);
        const { events } = await api.events(activeId);
        if (cancelled) return;
        setEvents(events);
        setVersion((v) => v + 1);
        if (s.status === "running") openSocket(activeId, events.length ? events[events.length - 1].seq : 0);
      } catch (e) {
        if (!cancelled) {
          setActiveId(null);
        }
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();

    function openSocket(id: string, lastSeq: number) {
      const ws = new WebSocket(api.liveUrl(id));
      wsRef.current = ws;
      let seen = lastSeq;
      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.type === "snapshot" || data.type === "events") {
          const fresh = (data.events as TraceEvent[]).filter((e) => e.seq > seen);
          if (fresh.length) {
            seen = Math.max(seen, ...fresh.map((e) => e.seq));
            setEvents((prev) => prev.concat(fresh));
            bump();
          }
        } else if (data.type === "status") {
          if (data.status !== "running") {
            api.session(id).then((s) => {
              if (cancelled) return;
              setSession(s);
              setVersion((v) => v + 1);
              refreshSessions();
              notify({
                kind: s.status === "completed" ? "success" : s.status === "stopped" ? "info" : "error",
                title: s.status === "completed" ? `Trace completed: ${s.name}` : `Trace ${s.status}: ${s.name}`,
                body: s.error ?? `${s.event_count} events captured.`,
              });
            });
          } else {
            setSession((p) => (p ? { ...p, status: "running" } : p));
          }
        }
      };
      ws.onerror = () => {
        /* REST views still work; the status poll below recovers */
      };
    }

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [activeId, mode, bump, notify, refreshSessions, setActiveId]);

  const isRunning = session?.status === "running";

  const value = useMemo<TraceState>(
    () => ({
      backendUp, env, refreshHealth, mode, setMode, sessions, refreshSessions, activeId, setActiveId,
      session, events, eventsLoading, version, isRunning, notify, notices, toasts, dismissToast,
    }),
    [backendUp, env, refreshHealth, mode, setMode, sessions, refreshSessions, activeId, setActiveId,
      session, events, eventsLoading, version, isRunning, notify, notices, toasts, dismissToast],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrace(): TraceState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTrace must be used inside TraceProvider");
  return v;
}

/** Fetch an analysis resource for the active session; refetches when data changes. */
export function useAnalysis<T>(fetcher: (id: string) => Promise<T>): { data: T | null; loading: boolean; error: string | null } {
  const { activeId, version } = useTrace();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!activeId) {
      setData(null);
      return;
    }
    let cancelled = false;
    if (lastId.current !== activeId) {
      setData(null);
      setLoading(true);
      lastId.current = activeId;
    }
    fetcher(activeId)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, version]);

  return { data, loading, error };
}
