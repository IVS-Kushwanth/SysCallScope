"""
Safe strace execution with live, incremental parsing.

Safety rules enforced here:
  * no shell — subprocess argument arrays only
  * executables must resolve (realpath) into sample_programs/bin, an explicitly
    configured directory, or be an allow-listed system utility
  * argument count/length limits, no NUL bytes, no ".." traversal, absolute
    paths only inside the session workspace / sample directory
  * timeouts, trace-file size limits, captured-output limits
  * every run gets its own process group so Stop kills strace *and* the tracee
  * the API refuses to start as root (override only for throwaway containers)
"""
from __future__ import annotations

import asyncio
import os
import platform
try:
    import resource
except ImportError:
    resource = None
import shutil
import signal
import subprocess
import time
import uuid
from pathlib import Path
from typing import Optional

SIGKILL = getattr(signal, "SIGKILL", getattr(signal, "SIGTERM", 9))
SIGTERM = getattr(signal, "SIGTERM", 15)

import database as db
from config import (ALLOWED_SYSTEM_COMMANDS, EXTRA_ALLOWED_DIRS, MAX_ARG_LEN, MAX_ARGS,
                    MAX_CONCURRENT_TRACES, MAX_EVENTS, MAX_STDOUT_BYTES, MAX_TRACE_BYTES,
                    SAMPLE_BIN_DIR, SAMPLE_DIR, STRACE_STRING_SIZE, SYSTEM_BIN_DIRS,
                    TRACE_DIR, TRACE_TIMEOUT_MAX, WORKSPACE_DIR)
from parser import StraceParser
from samples import get_sample


class TraceError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


# ---------------------------------------------------------------- environment
def read_ptrace_scope() -> Optional[int]:
    try:
        return int(Path("/proc/sys/kernel/yama/ptrace_scope").read_text().strip())
    except Exception:
        return None


def environment() -> dict:
    system = platform.system()
    strace = shutil.which("strace")
    version = None
    if strace:
        try:
            out = subprocess.run([strace, "-V"], capture_output=True, text=True, timeout=3)
            version = (out.stdout or out.stderr).splitlines()[0].strip()
        except Exception:
            version = None
    is_wsl = False
    try:
        is_wsl = "microsoft" in Path("/proc/version").read_text().lower()
    except Exception:
        pass
    scope = read_ptrace_scope()
    ptrace_note = {
        None: "Yama LSM not present; ptrace permitted for your own processes.",
        0: "Classic ptrace permissions: you can trace any process you own.",
        1: "Restricted ptrace: you can trace processes you start (children). SyscallScope starts every traced program itself, so this works.",
        2: "Admin-only ptrace: tracing requires CAP_SYS_PTRACE. Run `sudo sysctl kernel.yama.ptrace_scope=1` to allow tracing your own children.",
        3: "ptrace is disabled on this system until reboot. Tracing will not work.",
    }.get(scope, "Unknown ptrace_scope value.")
    compiled = [p.name for p in SAMPLE_BIN_DIR.glob("*") if p.is_file() and os.access(p, os.X_OK)] if SAMPLE_BIN_DIR.exists() else []
    return {
        "platform": system,
        "kernel": platform.release(),
        "is_linux": system == "Linux",
        "is_wsl": is_wsl,
        "strace_path": strace,
        "strace_version": version,
        "strace_available": bool(strace) and system == "Linux",
        "ptrace_scope": scope,
        "ptrace_note": ptrace_note,
        "tracing_possible": bool(strace) and system == "Linux" and scope not in (2, 3),
        "running_as_root": hasattr(os, "geteuid") and os.geteuid() == 0,
        "compiled_samples": sorted(compiled),
        "allowed_system_commands": sorted(ALLOWED_SYSTEM_COMMANDS),
        "allowed_dirs": [str(SAMPLE_BIN_DIR)] + [str(d) for d in EXTRA_ALLOWED_DIRS],
        "install_hint": "sudo apt update && sudo apt install -y strace build-essential",
    }


# ---------------------------------------------------------------- validation
def _inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def resolve_executable(program_id: Optional[str], executable: Optional[str]) -> tuple[Path, Optional[dict]]:
    if program_id:
        sample = get_sample(program_id)
        if not sample:
            raise TraceError(f"Unknown sample program '{program_id}'.")
        p = (SAMPLE_BIN_DIR / sample["id"]).resolve()
        if not p.exists():
            raise TraceError(f"Sample '{sample['name']}' is not compiled yet. Run `make -C sample_programs` and try again.")
        return p, sample
    if not executable or not executable.strip():
        raise TraceError("Choose a sample program or enter an executable.")
    exe = executable.strip()
    if "\x00" in exe or any(ch in exe for ch in ";|&$`<>\n") or len(exe) > MAX_ARG_LEN:
        raise TraceError("Executable must be a plain path or command name, without shell syntax.")
    if "/" in exe:
        cand = Path(exe)
        if not cand.is_absolute():
            cand = SAMPLE_BIN_DIR / cand
        real = cand.resolve()
    else:
        found = shutil.which(exe, path=os.pathsep.join(str(d) for d in [SAMPLE_BIN_DIR, *EXTRA_ALLOWED_DIRS, *SYSTEM_BIN_DIRS]))
        if not found:
            raise TraceError(f"'{exe}' was not found in the approved directories.")
        real = Path(found).resolve()
    if not real.is_file() or not os.access(real, os.X_OK):
        raise TraceError(f"'{exe}' is not an executable file.")
    if _inside(real, SAMPLE_BIN_DIR.resolve()) or any(_inside(real, d) for d in EXTRA_ALLOWED_DIRS):
        return real, None
    # system utility: allow only explicitly approved names
    name = Path(exe).name
    if any(_inside(real, d.resolve()) for d in SYSTEM_BIN_DIRS) and (name in ALLOWED_SYSTEM_COMMANDS or real.name in ALLOWED_SYSTEM_COMMANDS):
        return real, None
    raise TraceError(
        f"'{exe}' is outside the approved locations. Allowed: sample programs, "
        f"directories in SYSCALLSCOPE_ALLOWED_DIRS, or these utilities: {', '.join(sorted(ALLOWED_SYSTEM_COMMANDS))}.",
        status=403,
    )


def validate_args(args: list[str], workdir: Path) -> list[str]:
    if len(args) > MAX_ARGS:
        raise TraceError(f"At most {MAX_ARGS} arguments are allowed.")
    clean = []
    for a in args:
        if not isinstance(a, str) or "\x00" in a or len(a) > MAX_ARG_LEN:
            raise TraceError("Arguments must be short plain strings.")
        parts = Path(a).parts
        if ".." in parts:
            raise TraceError("Arguments may not contain '..' (path traversal).")
        if a.startswith("/"):
            real = Path(a).resolve()
            if not (_inside(real, workdir) or _inside(real, SAMPLE_DIR.resolve())):
                raise TraceError("Absolute paths are only allowed inside the session workspace or sample_programs/.")
        if a.startswith("~"):
            raise TraceError("Home-relative paths are not allowed.")
        clean.append(a)
    return clean


# ---------------------------------------------------------------- broadcasting
class Broadcaster:
    def __init__(self) -> None:
        self.subscribers: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=5000)
        self.subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self.subscribers.discard(q)

    def publish(self, msg: dict) -> None:
        for q in list(self.subscribers):
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                pass  # slow client; it can resync from the REST API


RUNS: dict[str, "BaseRun"] = {}


class BaseRun:
    def __init__(self, sid: str):
        self.sid = sid
        self.bus = Broadcaster()
        self.stop_requested = False
        self.done = asyncio.Event()
        self.task: Optional[asyncio.Task] = None

    def emit_events(self, events: list[dict]) -> None:
        if events:
            db.insert_events(self.sid, events)
            self.bus.publish({"type": "events", "events": [{k: v for k, v in e.items() if k != "raw"} for e in events]})

    def emit_status(self, status: str, **extra) -> None:
        self.bus.publish({"type": "status", "status": status, **extra})

    async def stop(self) -> None:
        self.stop_requested = True


def _limits(cpu_seconds: int):
    def apply():
        if resource is not None:
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 2))
            resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_TRACE_BYTES + 1024 * 1024,) * 2)
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    return apply


class TraceRun(BaseRun):
    def __init__(self, sid, cmd, workdir: Path, trace_file: Path, timeout: int):
        super().__init__(sid)
        self.cmd = cmd
        self.workdir = workdir
        self.trace_file = trace_file
        self.timeout = timeout
        self.proc: Optional[asyncio.subprocess.Process] = None
        self.parser = StraceParser()
        self.stdout = bytearray()
        self.stderr = bytearray()
        self.event_total = 0
        self.truncated = False

    async def _drain(self, stream, buf: bytearray):
        while True:
            chunk = await stream.read(4096)
            if not chunk:
                break
            if len(buf) < MAX_STDOUT_BYTES:
                buf.extend(chunk[: MAX_STDOUT_BYTES - len(buf)])

    def _kill(self, sig=None):
        if sig is None:
            sig = SIGKILL
        if self.proc and self.proc.returncode is None:
            try:
                if hasattr(os, "killpg"):
                    os.killpg(self.proc.pid, sig)
                else:
                    self.proc.kill()
            except (ProcessLookupError, OSError):
                pass

    async def stop(self) -> None:
        self.stop_requested = True
        self._kill(SIGTERM)
        await asyncio.sleep(0.5)
        self._kill(SIGKILL)

    async def _tail(self):
        pos = 0
        remainder = ""
        batch: list[dict] = []
        last_flush = time.monotonic()
        while True:
            finished = self.proc.returncode is not None
            if self.trace_file.exists():
                size = self.trace_file.stat().st_size
                if size > MAX_TRACE_BYTES and not self.truncated:
                    self.truncated = True
                    self._kill()
                with open(self.trace_file, "r", errors="replace") as fh:
                    fh.seek(pos)
                    data = fh.read(1024 * 1024)
                    pos = fh.tell()
                if data:
                    lines = (remainder + data).split("\n")
                    remainder = lines.pop()
                    for ln in lines:
                        for ev in self.parser.feed(ln):
                            if self.event_total < MAX_EVENTS:
                                batch.append(ev.to_dict())
                                self.event_total += 1
                            else:
                                self.truncated = True
                    if len(data) == 1024 * 1024:
                        finished = False  # more to read
            now = time.monotonic()
            if batch and (now - last_flush > 0.15 or len(batch) > 400):
                self.emit_events(batch)
                batch = []
                last_flush = now
            if finished and not data_pending(self.trace_file, pos):
                break
            await asyncio.sleep(0.05)
        if remainder:
            batch.extend(e.to_dict() for e in self.parser.feed(remainder))
        batch.extend(e.to_dict() for e in self.parser.flush())
        self.emit_events(batch)

    async def run(self):
        status, error, exit_code = "completed", None, None
        try:
            exec_kwargs = {
                "stdin": asyncio.subprocess.DEVNULL,
                "stdout": asyncio.subprocess.PIPE,
                "stderr": asyncio.subprocess.PIPE,
                "cwd": str(self.workdir),
                "env": {"PATH": "/usr/local/bin:/usr/bin:/bin", "LANG": "C.UTF-8", "HOME": str(self.workdir)},
            }
            if hasattr(os, "setsid"):
                exec_kwargs["start_new_session"] = True
            if platform.system() != "Windows":
                exec_kwargs["preexec_fn"] = _limits(self.timeout + 5)
            self.proc = await asyncio.create_subprocess_exec(
                *self.cmd,
                **exec_kwargs,
            )
            self.emit_status("running")
            tail = asyncio.create_task(self._tail())
            drains = [asyncio.create_task(self._drain(self.proc.stdout, self.stdout)),
                      asyncio.create_task(self._drain(self.proc.stderr, self.stderr))]
            try:
                await asyncio.wait_for(self.proc.wait(), timeout=self.timeout)
            except asyncio.TimeoutError:
                status = "timeout"
                error = f"Trace stopped after the {self.timeout}s timeout."
                self._kill()
                await self.proc.wait()
            await asyncio.gather(*drains, return_exceptions=True)
            await tail
            exit_code = self.proc.returncode
            err_text = self.stderr.decode(errors="replace")
            if self.stop_requested and status != "timeout":
                status, error = "stopped", "Stopped by user."
            elif "ptrace" in err_text and ("Operation not permitted" in err_text or "EPERM" in err_text):
                status = "failed"
                error = ("strace could not attach (ptrace: Operation not permitted). Check "
                         "/proc/sys/kernel/yama/ptrace_scope and that you are not inside a container without CAP_SYS_PTRACE.")
            elif self.event_total == 0:
                status = "failed"
                error = err_text.strip()[:500] or "strace produced no events."
            if self.truncated:
                error = (error + " " if error else "") + "Trace truncated: size/event limit reached."
        except Exception as exc:  # pragma: no cover - surfaced to UI
            status, error = "failed", f"{type(exc).__name__}: {exc}"
        finally:
            out = self.stdout.decode(errors="replace")
            err = self.stderr.decode(errors="replace")
            combined = out + (("\n[stderr]\n" + err) if err.strip() else "")
            db.update_session(self.sid, status=status, ended_at=time.time(), exit_code=exit_code,
                              error=error, stdout=combined[:MAX_STDOUT_BYTES])
            self.emit_status(status, error=error, exit_code=exit_code)
            self.done.set()
            RUNS.pop(self.sid, None)


def data_pending(path: Path, pos: int) -> bool:
    try:
        return path.stat().st_size > pos
    except FileNotFoundError:
        return False


async def start_trace(program_id, executable, args, follow_forks, timeout) -> dict:
    env = environment()
    if not env["is_linux"]:
        raise TraceError("Live tracing needs Linux (Ubuntu or WSL2). Use Demo mode on this machine.", 503)
    if not env["strace_available"]:
        raise TraceError(f"strace is not installed. Install it with: {env['install_hint']}", 503)
    if env["ptrace_scope"] in (2, 3):
        raise TraceError(env["ptrace_note"], 503)
    active = [r for r in RUNS.values() if isinstance(r, TraceRun)]
    if len(active) >= MAX_CONCURRENT_TRACES:
        raise TraceError("Too many traces are running. Stop one first.", 429)

    exe, sample = resolve_executable(program_id, executable)
    sid = uuid.uuid4().hex[:12]
    workdir = (WORKSPACE_DIR / "sessions" / sid).resolve()
    workdir.mkdir(parents=True, exist_ok=True)
    src_sample = SAMPLE_DIR / "sample.txt"
    if src_sample.exists():
        shutil.copy(src_sample, workdir / "sample.txt")
    args = validate_args(list(args or (sample["default_args"] if sample else [])), workdir)
    timeout = max(1, min(int(timeout or 15), TRACE_TIMEOUT_MAX))
    trace_file = TRACE_DIR / f"{sid}.log"
    cmd = [env["strace_path"], "-ttt", "-T", "-s", str(STRACE_STRING_SIZE), "-o", str(trace_file)]
    if follow_forks:
        cmd.insert(1, "-f")
    cmd += ["--", str(exe), *args]

    db.create_session({
        "id": sid, "name": sample["name"] if sample else exe.name, "mode": "live",
        "program": str(exe), "program_id": sample["id"] if sample else None, "argv": args,
        "command": " ".join(cmd), "status": "running", "started_at": time.time(),
        "follow_forks": 1 if follow_forks else 0,
    })
    run = TraceRun(sid, cmd, workdir, trace_file, timeout)
    RUNS[sid] = run
    run.task = asyncio.create_task(run.run())
    return db.get_session(sid)


# ---------------------------------------------------------------- demo replay
class DemoReplay(BaseRun):
    """Streams a pre-generated demo trace through the same live pipeline."""

    def __init__(self, sid: str, events: list[dict], speed: float = 1.0):
        super().__init__(sid)
        self.events = events
        self.speed = speed

    async def run(self):
        status = "completed"
        try:
            self.emit_status("running")
            i = 0
            while i < len(self.events):
                if self.stop_requested:
                    status = "stopped"
                    break
                chunk = self.events[i:i + 3]
                i += 3
                self.emit_events(chunk)
                await asyncio.sleep(0.09 / self.speed)
        finally:
            db.update_session(self.sid, status=status, ended_at=time.time(),
                              exit_code=0 if status == "completed" else None,
                              error=None if status == "completed" else "Stopped by user.")
            self.emit_status(status)
            self.done.set()
            RUNS.pop(self.sid, None)
