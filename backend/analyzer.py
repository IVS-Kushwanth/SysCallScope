"""Turn parsed events into statistics, file activity and memory activity."""
from __future__ import annotations

from collections import Counter, defaultdict
from statistics import mean

from categories import (CATEGORIES, CREATION_CALLS, OPEN_CALLS, PATH_PROBE_CALLS,
                        READ_CALLS, WRITE_CALLS)
from parser import split_args, unquote, parse_int


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = max(0, min(len(s) - 1, int(round((pct / 100) * (len(s) - 1)))))
    return s[k]


# --------------------------------------------------------------------------- stats
def compute_stats(events: list[dict]) -> dict:
    sys = [e for e in events if e["kind"] == "syscall"]
    durations = [e["duration"] for e in sys if e.get("duration") is not None]
    by_name = Counter(e["name"] for e in sys)
    by_cat = Counter(e["category"] for e in sys)
    failed = [e for e in sys if e["status"] == "failed"]
    errno_counts = Counter(e["errno"] for e in failed if e.get("errno"))
    status_counts = Counter(e["status"] for e in sys)
    per_pid = Counter(e["pid"] for e in sys)

    dur_by_name: dict[str, list[float]] = defaultdict(list)
    fail_by_name = Counter(e["name"] for e in failed)
    for e in sys:
        if e.get("duration") is not None:
            dur_by_name[e["name"]].append(e["duration"])

    per_call = []
    for name, cnt in by_name.most_common():
        d = dur_by_name.get(name, [])
        per_call.append({
            "name": name, "count": cnt, "failed": fail_by_name.get(name, 0),
            "total_time": sum(d), "avg_time": mean(d) if d else 0.0, "max_time": max(d) if d else 0.0,
            "category": next((e["category"] for e in sys if e["name"] == name), "other"),
        })

    ts = [e["ts"] for e in events]
    end_ts = [e["ts"] + (e.get("duration") or 0) for e in events]
    p95 = _percentile(durations, 95)
    long_threshold = max(p95, 0.0005)
    longest = sorted((e for e in sys if e.get("duration") is not None),
                     key=lambda e: e["duration"], reverse=True)[:12]

    files = set()
    for e in sys:
        if e["name"] in OPEN_CALLS or e["name"] in PATH_PROBE_CALLS:
            p = _path_arg(e)
            if p:
                files.add(p)

    return {
        "total": len(sys),
        "successful": status_counts.get("success", 0),
        "failed": status_counts.get("failed", 0),
        "interrupted": status_counts.get("interrupted", 0),
        "unfinished": status_counts.get("unfinished", 0),
        "signals": sum(1 for e in events if e["kind"] == "signal"),
        "processes_created": sum(1 for e in sys if e["name"] in CREATION_CALLS and e["status"] == "success"),
        "unique_pids": len({e["pid"] for e in events}),
        "files_accessed": len(files),
        "execution_time": (max(end_ts) - min(ts)) if ts else 0.0,
        "syscall_time": sum(durations),
        "avg_duration": mean(durations) if durations else 0.0,
        "p95_duration": p95,
        "long_threshold": long_threshold,
        "by_name": dict(by_name.most_common()),
        "by_category": {c: by_cat.get(c, 0) for c in CATEGORIES},
        "errno_counts": dict(errno_counts.most_common()),
        "per_pid": {str(k): v for k, v in per_pid.most_common()},
        "per_call": per_call,
        "longest": [_slim(e) for e in longest],
        "failed_calls": [_slim(e) for e in failed[:200]],
        "durations": [round(d * 1e6, 3) for d in durations[:20000]],  # microseconds
        "file_ops": by_cat.get("file", 0),
        "memory_ops": by_cat.get("memory", 0),
        "process_ops": by_cat.get("process", 0),
        "start_ts": min(ts) if ts else None,
        "end_ts": max(end_ts) if ts else None,
    }


def _slim(e: dict) -> dict:
    return {k: e.get(k) for k in ("seq", "pid", "ts", "name", "category", "status", "args", "ret",
                                  "errno", "error_msg", "duration")}


def _path_arg(e: dict) -> str | None:
    parts = split_args(e.get("args") or "")
    name = e["name"]
    idx = 1 if name in ("openat", "openat2", "faccessat", "faccessat2", "newfstatat", "statx",
                        "unlinkat", "mkdirat", "readlinkat") else 0
    if len(parts) > idx and parts[idx].startswith('"'):
        return unquote(parts[idx])
    return None


# ---------------------------------------------------------------------- file activity
def file_activity(events: list[dict]) -> dict:
    fd_tables: dict[int, dict[int, dict]] = defaultdict(dict)
    ops = []
    summary: dict[str, dict] = {}

    def summ(path: str) -> dict:
        if path not in summary:
            summary[path] = {"path": path, "opens": 0, "reads": 0, "writes": 0, "closes": 0,
                             "probes": 0, "bytes_read": 0, "bytes_written": 0, "errors": 0,
                             "fds": [], "modes": [], "pids": []}
        return summary[path]

    std = {0: "<stdin>", 1: "<stdout>", 2: "<stderr>"}

    def resolve(pid: int, fd: int | None) -> str | None:
        if fd is None:
            return None
        ent = fd_tables[pid].get(fd)
        if ent:
            return ent["path"]
        return std.get(fd)

    for e in sorted(events, key=lambda x: (x["ts"], x["seq"])):
        if e["kind"] != "syscall":
            continue
        name, pid = e["name"], e["pid"]
        parts = split_args(e.get("args") or "")
        ok = e["status"] == "success"
        op = None

        if name in CREATION_CALLS and ok and e.get("retval"):
            fd_tables[e["retval"]] = {k: dict(v) for k, v in fd_tables[pid].items()}
            continue
        if name in ("execve", "execveat") and ok:
            fd_tables[pid] = {k: v for k, v in fd_tables[pid].items() if not v.get("cloexec")}
            continue

        if name in ("pipe", "pipe2") and ok and parts:
            fds = [parse_int(x) for x in parts[0].strip("[]").split(",")]
            if len(fds) == 2 and None not in fds:
                for fd, end in zip(fds, ("read end", "write end")):
                    fd_tables[pid][fd] = {"path": f"pipe ({end})", "cloexec": "O_CLOEXEC" in (e.get("args") or "")}
                    summ(f"pipe ({end})")["fds"].append(fd)
                op = {"op": "pipe", "path": "pipe (read end)", "fd": fds[0]}
        elif name in OPEN_CALLS:
            path = _path_arg(e) or "?"
            flag_idx = 2 if name.startswith("openat") else 1
            flags = parts[flag_idx] if len(parts) > flag_idx else ""
            fd = e.get("retval") if ok else None
            op = {"op": "open", "path": path, "fd": fd, "flags": flags}
            s = summ(path)
            s["opens"] += 1
            if flags and flags not in s["modes"]:
                s["modes"].append(flags)
            if fd is not None:
                fd_tables[pid][fd] = {"path": path, "cloexec": "O_CLOEXEC" in flags}
                if fd not in s["fds"]:
                    s["fds"].append(fd)
        elif name in READ_CALLS or name in WRITE_CALLS:
            fd = parse_int(parts[0]) if parts else None
            path = resolve(pid, fd) or f"fd {fd}"
            n = e.get("retval") if ok else None
            is_read = name in READ_CALLS
            op = {"op": "read" if is_read else "write", "path": path, "fd": fd, "bytes": n}
            s = summ(path)
            if is_read:
                s["reads"] += 1
                s["bytes_read"] += n or 0
            else:
                s["writes"] += 1
                s["bytes_written"] += n or 0
        elif name == "close":
            fd = parse_int(parts[0]) if parts else None
            path = resolve(pid, fd) or f"fd {fd}"
            op = {"op": "close", "path": path, "fd": fd}
            summ(path)["closes"] += 1
            if ok and fd is not None:
                fd_tables[pid].pop(fd, None)
        elif name in ("dup", "dup2", "dup3", "fcntl") and ok:
            fd = parse_int(parts[0]) if parts else None
            if name == "fcntl" and not (len(parts) > 1 and "F_DUPFD" in parts[1]):
                continue
            new = e.get("retval")
            src = fd_tables[pid].get(fd) or ({"path": std[fd]} if fd in std else None)
            if src and new is not None:
                fd_tables[pid][new] = {"path": src["path"], "cloexec": "CLOEXEC" in (e.get("args") or "")}
            op = {"op": "dup", "path": (src or {}).get("path", f"fd {fd}"), "fd": new}
        elif name in PATH_PROBE_CALLS or name in ("fstat",):
            if name == "fstat":
                fd = parse_int(parts[0]) if parts else None
                path = resolve(pid, fd) or f"fd {fd}"
            else:
                path = _path_arg(e)
                if not path:
                    continue
            kind = "unlink" if name.startswith("unlink") else ("access" if "access" in name else "stat")
            op = {"op": kind, "path": path, "fd": None}
            summ(path)["probes"] += 1
        else:
            continue

        if op:
            s = summary.get(op["path"])
            if s is not None:
                if not ok:
                    s["errors"] += 1
                if pid not in s["pids"]:
                    s["pids"].append(pid)
            op.update({"seq": e["seq"], "pid": pid, "ts": e["ts"], "syscall": name,
                       "status": e["status"], "errno": e.get("errno"), "error_msg": e.get("error_msg"),
                       "duration": e.get("duration"), "args": e.get("args"), "ret": e.get("ret")})
            ops.append(op)

    files = sorted(summary.values(), key=lambda s: (-(s["opens"] + s["reads"] + s["writes"]), s["path"]))
    counts = Counter(o["op"] for o in ops)
    return {
        "operations": ops,
        "files": files,
        "counts": dict(counts),
        "failed": [o for o in ops if o["status"] == "failed"],
        "errno_counts": dict(Counter(o["errno"] for o in ops if o.get("errno"))),
    }


# -------------------------------------------------------------------- memory activity
def memory_activity(events: list[dict]) -> dict:
    ops = []
    regions: list[dict] = []
    brk_state: dict[int, dict] = {}
    fd_paths: dict[int, dict[int, str]] = defaultdict(dict)

    for e in sorted(events, key=lambda x: (x["ts"], x["seq"])):
        if e["kind"] != "syscall":
            continue
        name, pid = e["name"], e["pid"]
        parts = split_args(e.get("args") or "")
        ok = e["status"] == "success"
        if name in OPEN_CALLS and ok and e.get("retval") is not None:
            fd_paths[pid][e["retval"]] = _path_arg(e) or "?"
            continue
        if name in CREATION_CALLS and ok and e.get("retval"):
            fd_paths[e["retval"]] = dict(fd_paths[pid])
            continue
        base = {"seq": e["seq"], "pid": pid, "ts": e["ts"], "syscall": name, "status": e["status"],
                "errno": e.get("errno"), "duration": e.get("duration"), "args": e.get("args"), "ret": e.get("ret")}
        if name == "mmap" and len(parts) >= 6:
            size = parse_int(parts[1]) or 0
            fd = parse_int(parts[4])
            addr = parse_int(e.get("ret") or "") if ok else None
            source = "anonymous" if "MAP_ANONYMOUS" in parts[3] else fd_paths[pid].get(fd, f"fd {fd}")
            op = {**base, "op": "map", "addr": addr, "size": size, "prot": parts[2], "flags": parts[3], "source": source}
            ops.append(op)
            if ok and addr is not None:
                regions.append({"pid": pid, "start": addr, "end": addr + size, "size": size, "prot": parts[2],
                                "flags": parts[3], "source": source, "kind": "mmap", "seq": e["seq"], "active": True})
        elif name == "munmap" and len(parts) >= 2:
            addr = parse_int(parts[0]) or 0
            size = parse_int(parts[1]) or 0
            ops.append({**base, "op": "unmap", "addr": addr, "size": size})
            if ok:
                for r in regions:
                    if r["pid"] == pid and r["active"] and r["start"] < addr + size and addr < r["end"]:
                        if addr <= r["start"] and addr + size >= r["end"]:
                            r["active"] = False
                        else:
                            r["partially_unmapped"] = True
        elif name == "mprotect" and len(parts) >= 3:
            addr = parse_int(parts[0]) or 0
            size = parse_int(parts[1]) or 0
            ops.append({**base, "op": "protect", "addr": addr, "size": size, "prot": parts[2]})
            if ok:
                for r in regions:
                    if r["pid"] == pid and r["active"] and r["start"] <= addr < r["end"]:
                        r.setdefault("protect_changes", []).append({"addr": addr, "size": size, "prot": parts[2]})
        elif name == "brk":
            req = parse_int(parts[0]) if parts else None
            cur = parse_int(e.get("ret") or "")
            st = brk_state.setdefault(pid, {"initial": None, "current": None})
            if req in (0, None) and cur:
                st["initial"] = st["initial"] or cur
            if cur:
                st["current"] = cur
            grow = (cur - (st["initial"] or cur)) if cur else 0
            ops.append({**base, "op": "brk", "addr": cur, "requested": req, "size": grow})

    heaps = []
    for pid, st in brk_state.items():
        if st["initial"] and st["current"] and st["current"] > st["initial"]:
            heaps.append({"pid": pid, "start": st["initial"], "end": st["current"],
                          "size": st["current"] - st["initial"], "prot": "PROT_READ|PROT_WRITE",
                          "flags": "heap (brk)", "source": "[heap]", "kind": "brk", "active": True})

    counts = Counter(o["op"] for o in ops)
    return {
        "operations": ops,
        "regions": regions + heaps,
        "counts": dict(counts),
        "bytes_mapped": sum(o["size"] for o in ops if o["op"] == "map" and o["status"] == "success"),
        "bytes_unmapped": sum(o["size"] for o in ops if o["op"] == "unmap" and o["status"] == "success"),
        "heap_growth": sum(h["size"] for h in heaps),
        "failed": [o for o in ops if o["status"] == "failed"],
    }
