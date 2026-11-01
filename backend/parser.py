"""
Parser for strace output produced with:  strace -f -ttt -T -o <file> <program>

Handles:
  * PID prefixes ("1234 ..." and "[pid 1234] ...")
  * epoch timestamps (-ttt) and durations (-T, "<0.000012>")
  * <unfinished ...> / <... name resumed> pairs (merged into one event)
  * failed calls ("= -1 ENOENT (No such file or directory)")
  * calls without a return value ("exit_group(0) = ?")
  * signals ("--- SIGCHLD {...} ---")
  * process exits ("+++ exited with 0 +++", "+++ killed by SIGKILL +++")
  * strings containing parentheses, commas and escaped quotes

The parser is incremental: feed() lines one at a time and it yields
completed events, so the same code serves live tracing and post-processing.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from typing import Iterable, Iterator, Optional

from categories import categorize

HEADER_RE = re.compile(r"^(?:\[pid\s+(\d+)\]|(\d+))?\s*(\d+\.\d+)\s+(.*)$")
DURATION_RE = re.compile(r"\s*<(\d+\.\d+)>\s*$")
RESUMED_RE = re.compile(r"^<\.\.\.\s+([\w]+)\s+resumed>\s?(.*)$")
CALL_RE = re.compile(r"^([a-zA-Z_][\w]*)\((.*)$", re.S)
RESULT_RE = re.compile(
    r"^\s*=\s*(?P<ret>-?\d+|0x[0-9a-fA-F]+|\?)"
    r"(?:\s+(?P<errno>E[A-Z0-9_]+)\s*\((?P<errmsg>[^)]*)\))?"
    r"(?:\s+\((?P<note>.*)\))?\s*$"
)
SIGNAL_RE = re.compile(r"^---\s+(SIG[A-Z0-9]+)\s*(.*?)\s*---$")
EXIT_RE = re.compile(r"^\+\+\+\s+exited with (-?\d+)\s+\+\+\+$")
KILLED_RE = re.compile(r"^\+\+\+\s+killed by (SIG[A-Z0-9]+)(.*?)\s*\+\+\+$")
UNFINISHED = "<unfinished ...>"


@dataclass
class Event:
    seq: int
    pid: int
    ts: float
    name: str
    category: str
    kind: str              # syscall | signal | exit | killed
    status: str            # success | failed | interrupted | unfinished | signal | exit
    args: str = ""
    ret: Optional[str] = None
    retval: Optional[int] = None
    errno: Optional[str] = None
    error_msg: Optional[str] = None
    duration: Optional[float] = None
    note: Optional[str] = None
    raw: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


def find_closing_paren(s: str, depth: int = 1) -> int:
    """Return the index of the ')' that brings depth to 0, respecting quoted strings."""
    in_str = False
    esc = False
    for i, ch in enumerate(s):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return i
    return -1


def split_args(args: str) -> list[str]:
    """Split a strace argument list on top-level commas."""
    out, buf = [], []
    depth = 0
    in_str = esc = False
    for ch in args:
        if in_str:
            buf.append(ch)
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "," and depth == 0:
            out.append("".join(buf).strip())
            buf = []
            continue
        buf.append(ch)
    tail = "".join(buf).strip()
    if tail:
        out.append(tail)
    return out


def unquote(s: str) -> str:
    s = s.strip()
    if s.endswith("..."):
        s = s[:-3]
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        s = s[1:-1]
    return s.encode("utf-8", "replace").decode("unicode_escape", "replace") if "\\" in s else s


def parse_int(v: str) -> Optional[int]:
    try:
        return int(v, 0)
    except (ValueError, TypeError):
        return None


class StraceParser:
    def __init__(self) -> None:
        self.seq = 0
        self.pending: dict[int, dict] = {}   # pid -> {name, args_prefix, ts, raw}
        self.default_pid: Optional[int] = None
        self.unparsed = 0

    def _next(self) -> int:
        self.seq += 1
        return self.seq

    def feed(self, line: str) -> list[Event]:
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("strace:"):
            return []
        m = HEADER_RE.match(line)
        if not m:
            self.unparsed += 1
            return []
        pid_s = m.group(1) or m.group(2)
        if pid_s:
            pid = int(pid_s)
            if self.default_pid is None:
                self.default_pid = pid
        else:
            pid = self.default_pid or 0
        ts = float(m.group(3))
        body = m.group(4).strip()

        # Signals
        sm = SIGNAL_RE.match(body)
        if sm:
            return [Event(self._next(), pid, ts, sm.group(1), "signal", "signal", "signal",
                          args=sm.group(2), raw=line)]
        em = EXIT_RE.match(body)
        if em:
            code = int(em.group(1))
            return [Event(self._next(), pid, ts, "exited", "process", "exit", "exit",
                          ret=str(code), retval=code, raw=line)]
        km = KILLED_RE.match(body)
        if km:
            return [Event(self._next(), pid, ts, "killed", "process", "killed", "failed",
                          args=km.group(1), note=km.group(2).strip(" ()") or None, raw=line)]

        # Resumed call
        rm = RESUMED_RE.match(body)
        if rm:
            name, rest = rm.group(1), rm.group(2)
            pend = self.pending.pop(pid, None)
            prefix = pend["args"] if pend and pend["name"] == name else ""
            start_ts = pend["ts"] if pend and pend["name"] == name else ts
            ev = self._complete(pid, start_ts, name, rest, prefix, line, depth=1)
            return [ev] if ev else []

        cm = CALL_RE.match(body)
        if not cm:
            self.unparsed += 1
            return []
        name, rest = cm.group(1), cm.group(2)
        if rest.rstrip().endswith(UNFINISHED):
            self.pending[pid] = {"name": name, "args": rest.rstrip()[: -len(UNFINISHED)].rstrip(),
                                 "ts": ts, "raw": line}
            return []
        ev = self._complete(pid, ts, name, rest, "", line, depth=1)
        return [ev] if ev else []

    def _complete(self, pid, ts, name, rest, prefix, raw, depth=1) -> Optional[Event]:
        duration = None
        dm = DURATION_RE.search(rest)
        if dm:
            duration = float(dm.group(1))
            rest = rest[: dm.start()]
        close = find_closing_paren(rest, depth)
        if close == -1:
            self.unparsed += 1
            return None
        tail = rest[:close].strip()
        args = (prefix.rstrip() + " " + tail).strip() if prefix else tail
        result = rest[close + 1:]
        ret = retval = errno = errmsg = note = None
        status = "success"
        rm = RESULT_RE.match(result)
        if rm:
            ret = rm.group("ret")
            retval = parse_int(ret) if ret != "?" else None
            errno = rm.group("errno")
            errmsg = rm.group("errmsg")
            note = rm.group("note")
            if errno:
                status = "interrupted" if errno.startswith("ERESTART") or errno == "EINTR" else "failed"
        elif result.strip():
            note = result.strip()
        return Event(self._next(), pid, ts, name, categorize(name), "syscall", status,
                     args=args, ret=ret, retval=retval, errno=errno, error_msg=errmsg,
                     duration=duration, note=note, raw=raw)

    def flush(self) -> list[Event]:
        """Emit calls that never resumed (e.g. the process was killed mid-call)."""
        out = []
        for pid, p in sorted(self.pending.items(), key=lambda kv: kv[1]["ts"]):
            out.append(Event(self._next(), pid, p["ts"], p["name"], categorize(p["name"]),
                             "syscall", "unfinished", args=p["args"], raw=p["raw"]))
        self.pending.clear()
        return out


def parse_lines(lines: Iterable[str]) -> list[Event]:
    p = StraceParser()
    events: list[Event] = []
    for ln in lines:
        events.extend(p.feed(ln))
    events.extend(p.flush())
    return events


def iter_file(path: str) -> Iterator[Event]:
    p = StraceParser()
    with open(path, "r", errors="replace") as fh:
        for ln in fh:
            yield from p.feed(ln)
    yield from p.flush()
