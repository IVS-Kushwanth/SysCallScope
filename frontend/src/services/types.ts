export type Mode = "live" | "demo";
export type EventStatus = "success" | "failed" | "interrupted" | "unfinished" | "signal" | "exit";
export type Category = "file" | "process" | "memory" | "signal" | "network" | "info" | "other";

export interface TraceEvent {
  seq: number;
  pid: number;
  ts: number;
  name: string;
  category: Category;
  kind: "syscall" | "signal" | "exit" | "killed";
  status: EventStatus;
  args: string;
  ret: string | null;
  retval: number | null;
  errno: string | null;
  error_msg: string | null;
  duration: number | null;
  note: string | null;
}

export interface Session {
  id: string;
  name: string;
  mode: Mode;
  program: string | null;
  program_id: string | null;
  argv: string[];
  command: string | null;
  status: "running" | "completed" | "stopped" | "failed" | "timeout";
  started_at: number;
  ended_at: number | null;
  exit_code: number | null;
  error: string | null;
  event_count: number;
  stdout?: string;
  follow_forks: boolean;
  live?: boolean;
}

export interface Environment {
  platform: string;
  kernel: string;
  is_linux: boolean;
  is_wsl: boolean;
  strace_path: string | null;
  strace_version: string | null;
  strace_available: boolean;
  ptrace_scope: number | null;
  ptrace_note: string;
  tracing_possible: boolean;
  running_as_root: boolean;
  compiled_samples: string[];
  allowed_system_commands: string[];
  allowed_dirs: string[];
  install_hint: string;
}

export interface SampleProgram {
  id: string;
  name: string;
  source: string;
  description: string;
  focus: string[];
  default_args: string[];
  binary: string;
  compiled: boolean;
  source_code: string;
}

export interface CallStat {
  name: string; count: number; failed: number; total_time: number; avg_time: number; max_time: number; category: Category;
}

export interface Stats {
  total: number; successful: number; failed: number; interrupted: number; unfinished: number; signals: number;
  processes_created: number; unique_pids: number; files_accessed: number; execution_time: number;
  syscall_time: number; avg_duration: number; p95_duration: number; long_threshold: number;
  by_name: Record<string, number>; by_category: Record<Category, number>; errno_counts: Record<string, number>;
  per_pid: Record<string, number>; per_call: CallStat[]; longest: TraceEvent[]; failed_calls: TraceEvent[];
  durations: number[]; file_ops: number; memory_ops: number; process_ops: number;
  start_ts: number | null; end_ts: number | null;
}

export interface ProcessInfo {
  pid: number; ppid: number | null; kind: "process" | "thread"; created_at: number; created_by: string | null;
  first_seen: number; last_seen: number; ended_at?: number;
  programs: { path: string; argv: string; ts: number; ok: boolean; seq: number }[];
  program: string | null; inherited_program?: boolean;
  exit_code: number | null; signal: string | null; syscall_count: number; failed_count: number;
  children: number[]; state: "created" | "running" | "waiting" | "terminated" | "failed";
  state_basis: "observed" | "inferred"; last_call: string | null; exec_failed: number;
}

export interface ProcessTree { processes: ProcessInfo[]; roots: number[]; count: number; threads: number }

export interface FileOp {
  op: string; path: string; fd: number | null; flags?: string; bytes?: number | null;
  seq: number; pid: number; ts: number; syscall: string; status: EventStatus; errno: string | null;
  error_msg: string | null; duration: number | null; args: string; ret: string | null;
}
export interface FileSummary {
  path: string; opens: number; reads: number; writes: number; closes: number; probes: number;
  bytes_read: number; bytes_written: number; errors: number; fds: number[]; modes: string[]; pids: number[];
}
export interface FileActivity {
  operations: FileOp[]; files: FileSummary[]; counts: Record<string, number>; failed: FileOp[];
  errno_counts: Record<string, number>;
}

export interface MemOp {
  seq: number; pid: number; ts: number; syscall: string; status: EventStatus; errno: string | null;
  duration: number | null; args: string; ret: string | null; op: "map" | "unmap" | "protect" | "brk";
  addr: number | null; size: number; prot?: string; flags?: string; source?: string; requested?: number | null;
}
export interface MemRegion {
  pid: number; start: number; end: number; size: number; prot: string; flags: string; source: string;
  kind: "mmap" | "brk"; active: boolean; partially_unmapped?: boolean; seq?: number;
}
export interface MemoryActivity {
  operations: MemOp[]; regions: MemRegion[]; counts: Record<string, number>; bytes_mapped: number;
  bytes_unmapped: number; heap_growth: number; failed: MemOp[];
}
