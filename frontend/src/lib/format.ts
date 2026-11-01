import type { Category, EventStatus } from "../services/types";

export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return "—";
  const us = sec * 1e6;
  if (us < 1000) return `${us.toFixed(us < 10 ? 1 : 0)} µs`;
  const ms = us / 1000;
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 2 : 1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function fmtClock(ts: number | null | undefined, withMs = true): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const base = d.toLocaleTimeString("en-GB", { hour12: false });
  if (!withMs) return base;
  const frac = (ts % 1).toFixed(6).slice(2);
  return `${base}.${frac}`;
}

export function fmtRelMs(ts: number, t0: number): string {
  return `+${((ts - t0) * 1000).toFixed(3)} ms`;
}

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  const u = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i ? 1 : 0)} ${u[i]}`;
}

export function fmtHex(n: number | null | undefined): string {
  return n == null ? "—" : "0x" + n.toString(16);
}

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export const CATEGORY_COLORS: Record<Category, string> = {
  file: "#1558C9",
  process: "#D4FF24",
  memory: "#6A9BF0",
  signal: "#FFB547",
  network: "#7FD1C7",
  info: "#9299A8",
  other: "#5B6475",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  file: "File", process: "Process", memory: "Memory", signal: "Signal", network: "Network", info: "Info", other: "Other",
};

export const CATEGORIES: Category[] = ["file", "process", "memory", "signal", "network", "info", "other"];

export const STATUS_COLORS: Record<EventStatus, string> = {
  success: "#D4FF24",
  failed: "#FF5252",
  interrupted: "#FFB547",
  unfinished: "#FFB547",
  signal: "#FFB547",
  exit: "#6A9BF0",
};

export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export const ERRNO_HELP: Record<string, string> = {
  ENOENT: "No such file or directory: the path does not exist.",
  EACCES: "Permission denied: the process lacks rights for this path.",
  EBADF: "Bad file descriptor: the fd is not open, or not open for this operation.",
  EEXIST: "File exists: O_CREAT|O_EXCL was used on a path that already exists.",
  ENOMEM: "Out of memory: the kernel refused the allocation request.",
  EINVAL: "Invalid argument: a flag or value was not accepted.",
  EPERM: "Operation not permitted: privileges are required.",
  EAGAIN: "Resource temporarily unavailable: try again later.",
  EINTR: "Interrupted by a signal before the call completed.",
  ENOTTY: "Inappropriate ioctl: the descriptor is not a terminal.",
  ECHILD: "No child processes to wait for.",
  ESRCH: "No such process.",
  ECONNREFUSED: "Connection refused by the remote side.",
  ENOTDIR: "A path component is not a directory.",
  EISDIR: "The path is a directory.",
};

/** Visual class for an event row in the live stream. */
export function eventTone(e: { name: string; category: Category; status: EventStatus; kind: string }):
  "fail" | "spawn" | "end" | "signal" | "memory" | "ok" {
  if (e.status === "failed" || e.kind === "killed") return "fail";
  if (e.kind === "exit" || e.name === "exit_group" || e.name === "exit") return "end";
  if (e.kind === "signal") return "signal";
  if (["fork", "vfork", "clone", "clone3", "execve", "execveat"].includes(e.name)) return "spawn";
  if (e.category === "memory") return "memory";
  return "ok";
}
