import type { Environment, FileActivity, MemoryActivity, ProcessTree, SampleProgram, Session, Stats, TraceEvent, Mode } from "./types";

// In development the Vite proxy forwards /api to the backend. Set VITE_API_URL
// (e.g. http://127.0.0.1:8000) when serving the built frontend elsewhere.
export const API_BASE: string = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("The SyscallScope backend is not reachable. Start it with `uvicorn main:app --port 8000` inside backend/.", 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ ok: boolean; environment: Environment }>("/api/health"),
  programs: () => req<{ programs: SampleProgram[] }>("/api/programs"),
  sessions: (mode?: Mode) => req<{ sessions: Session[] }>(`/api/traces${mode ? `?mode=${mode}` : ""}`),
  session: (id: string) => req<Session>(`/api/traces/${id}`),
  startTrace: (body: { program_id?: string; executable?: string; args: string[]; follow_forks: boolean; timeout: number }) =>
    req<Session>("/api/traces", { method: "POST", body: JSON.stringify(body) }),
  stopTrace: (id: string) => req<{ stopped: boolean }>(`/api/traces/${id}/stop`, { method: "POST" }),
  deleteTrace: (id: string) => req<{ deleted: string }>(`/api/traces/${id}`, { method: "DELETE" }),
  createDemo: (replay: boolean, speed = 1) =>
    req<Session>("/api/demo", { method: "POST", body: JSON.stringify({ scenario: "parent_child", replay, speed }) }),
  events: (id: string) => req<{ events: TraceEvent[] }>(`/api/traces/${id}/events?limit=50000`),
  stats: (id: string) => req<Stats>(`/api/traces/${id}/stats`),
  processes: (id: string) => req<ProcessTree>(`/api/traces/${id}/processes`),
  files: (id: string) => req<FileActivity>(`/api/traces/${id}/files`),
  memory: (id: string) => req<MemoryActivity>(`/api/traces/${id}/memory`),
  exportUrl: (id: string, fmt: "csv" | "json" | "pdf") => `${API_BASE}/api/traces/${id}/export/${fmt}`,
  liveUrl: (id: string) => {
    const base = API_BASE || window.location.origin;
    return base.replace(/^http/, "ws") + `/api/traces/${id}/live`;
  },
};
