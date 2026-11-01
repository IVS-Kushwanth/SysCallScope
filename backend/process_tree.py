"""
Reconstruct the process tree from parsed events.

What strace lets us OBSERVE:
  * fork/vfork/clone/clone3 return values (child PIDs) in the parent
  * execve calls (program image replaced)
  * the first and last system call made by each PID
  * "+++ exited with N +++" and "+++ killed by SIG +++" lines
What we INFER (and label as inferred):
  * "waiting" — the last observed call is a blocking wait4/waitid that never returned
  * "running" — the PID was seen making system calls and has not exited yet
strace cannot see scheduler run-queue states, so we never claim them.
"""
from __future__ import annotations

from categories import CREATION_CALLS
from parser import split_args, unquote

WAIT_CALLS = {"wait4", "waitid", "pause", "rt_sigsuspend", "futex", "nanosleep", "clock_nanosleep", "read"}


def build_process_tree(events: list[dict], session_running: bool = False) -> dict:
    procs: dict[int, dict] = {}
    order: list[int] = []

    def ensure(pid: int, ts: float) -> dict:
        if pid not in procs:
            procs[pid] = {
                "pid": pid, "ppid": None, "kind": "process", "created_at": ts,
                "created_by": None, "first_seen": ts, "last_seen": ts,
                "programs": [], "exit_code": None, "signal": None,
                "syscall_count": 0, "failed_count": 0, "children": [],
                "state": "running", "state_basis": "observed", "last_call": None,
                "last_status": None, "exec_failed": 0,
            }
            order.append(pid)
        return procs[pid]

    for ev in sorted(events, key=lambda e: (e["ts"], e["seq"])):
        p = ensure(ev["pid"], ev["ts"])
        p["first_seen"] = min(p["first_seen"], ev["ts"])
        p["last_seen"] = max(p["last_seen"], ev["ts"])
        kind = ev["kind"]
        if kind == "syscall":
            p["syscall_count"] += 1
            p["last_call"] = ev["name"]
            p["last_status"] = ev["status"]
            if ev["status"] == "failed":
                p["failed_count"] += 1
            if ev["name"] in CREATION_CALLS and ev["status"] == "success" and ev.get("retval"):
                child_pid = ev["retval"]
                c = ensure(child_pid, ev["ts"])
                c["ppid"] = p["pid"]
                c["created_by"] = ev["name"]
                c["created_at"] = ev["ts"]
                c["created_seq"] = ev["seq"]
                if "CLONE_THREAD" in (ev.get("args") or ""):
                    c["kind"] = "thread"
                if child_pid not in p["children"]:
                    p["children"].append(child_pid)
            if ev["name"] in ("execve", "execveat"):
                parts = split_args(ev.get("args") or "")
                prog = unquote(parts[1] if ev["name"] == "execveat" and len(parts) > 1 else (parts[0] if parts else ""))
                argv = parts[1] if ev["name"] == "execve" and len(parts) > 1 else ""
                p["programs"].append({"path": prog, "argv": argv, "ts": ev["ts"], "ok": ev["status"] == "success", "seq": ev["seq"]})
                if ev["status"] != "success":
                    p["exec_failed"] += 1
        elif kind == "exit":
            p["exit_code"] = ev.get("retval")
            p["state"] = "terminated" if ev.get("retval") == 0 else "failed"
            p["ended_at"] = ev["ts"]
        elif kind == "killed":
            p["signal"] = ev.get("args")
            p["state"] = "failed"
            p["ended_at"] = ev["ts"]

    for pid in order:
        p = procs[pid]
        if p["state"] in ("terminated", "failed"):
            continue
        if session_running and p["last_status"] == "unfinished" and p["last_call"] in WAIT_CALLS:
            p["state"], p["state_basis"] = "waiting", "inferred"
        elif session_running:
            p["state"], p["state_basis"] = "running", "inferred"
        elif p["syscall_count"] == 0:
            p["state"], p["state_basis"] = "created", "observed"
        else:
            # Trace ended without an exit line (e.g. stopped or detached).
            p["state"], p["state_basis"] = "running", "inferred"

    roots = [pid for pid in order if procs[pid]["ppid"] is None or procs[pid]["ppid"] not in procs]
    for p in procs.values():
        okp = [x for x in p["programs"] if x["ok"]]
        p["program"] = okp[-1]["path"] if okp else None
    # inherit program name from parent for forked children that never exec'd
    for pid in order:
        p = procs[pid]
        if not p["program"] and p["ppid"] in procs:
            p["program"] = procs[p["ppid"]].get("program")
            p["inherited_program"] = True

    return {
        "processes": [procs[pid] for pid in order],
        "roots": roots,
        "count": len(procs),
        "threads": sum(1 for p in procs.values() if p["kind"] == "thread"),
    }
