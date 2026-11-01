"""SQLite storage for trace sessions and their structured events."""
from __future__ import annotations

import json
import sqlite3
import threading
from typing import Optional

from config import DB_PATH

_lock = threading.Lock()
_conn: Optional[sqlite3.Connection] = None

EVENT_COLS = ["seq", "pid", "ts", "name", "category", "kind", "status", "args", "ret", "retval",
              "errno", "error_msg", "duration", "note", "raw"]


def conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA foreign_keys=ON")
        init()
    return _conn


def init() -> None:
    c = _conn
    c.executescript(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            mode TEXT NOT NULL CHECK (mode IN ('live','demo')),
            program TEXT,
            program_id TEXT,
            argv TEXT,
            command TEXT,
            status TEXT NOT NULL,
            started_at REAL,
            ended_at REAL,
            exit_code INTEGER,
            error TEXT,
            event_count INTEGER DEFAULT 0,
            stdout TEXT,
            follow_forks INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS events (
            session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            seq INTEGER NOT NULL,
            pid INTEGER, ts REAL, name TEXT, category TEXT, kind TEXT, status TEXT,
            args TEXT, ret TEXT, retval INTEGER, errno TEXT, error_msg TEXT,
            duration REAL, note TEXT, raw TEXT,
            PRIMARY KEY (session_id, seq)
        );
        CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events(session_id, ts);
        """
    )
    c.commit()


def create_session(row: dict) -> None:
    cols = list(row.keys())
    with _lock:
        conn().execute(
            f"INSERT INTO sessions ({','.join(cols)}) VALUES ({','.join('?' for _ in cols)})",
            [json.dumps(v) if isinstance(v, (list, dict)) else v for v in row.values()],
        )
        conn().commit()


def update_session(sid: str, **fields) -> None:
    if not fields:
        return
    with _lock:
        conn().execute(
            f"UPDATE sessions SET {', '.join(f'{k}=?' for k in fields)} WHERE id=?",
            [*fields.values(), sid],
        )
        conn().commit()


def _session_dict(r: sqlite3.Row) -> dict:
    d = dict(r)
    try:
        d["argv"] = json.loads(d["argv"]) if d.get("argv") else []
    except json.JSONDecodeError:
        d["argv"] = []
    d["follow_forks"] = bool(d.get("follow_forks"))
    return d


def get_session(sid: str) -> Optional[dict]:
    r = conn().execute("SELECT * FROM sessions WHERE id=?", (sid,)).fetchone()
    return _session_dict(r) if r else None


def list_sessions(mode: Optional[str] = None) -> list[dict]:
    q = "SELECT id,name,mode,program,program_id,argv,command,status,started_at,ended_at,exit_code,error,event_count,follow_forks FROM sessions"
    args: list = []
    if mode:
        q += " WHERE mode=?"
        args.append(mode)
    q += " ORDER BY started_at DESC"
    return [_session_dict(r) for r in conn().execute(q, args).fetchall()]


def delete_session(sid: str) -> None:
    with _lock:
        conn().execute("DELETE FROM events WHERE session_id=?", (sid,))
        conn().execute("DELETE FROM sessions WHERE id=?", (sid,))
        conn().commit()


def insert_events(sid: str, events: list[dict]) -> None:
    if not events:
        return
    with _lock:
        conn().executemany(
            f"INSERT OR REPLACE INTO events (session_id,{','.join(EVENT_COLS)}) VALUES (?{',?' * len(EVENT_COLS)})",
            [[sid, *[e.get(c) for c in EVENT_COLS]] for e in events],
        )
        conn().execute("UPDATE sessions SET event_count=(SELECT COUNT(*) FROM events WHERE session_id=?) WHERE id=?",
                       (sid, sid))
        conn().commit()


def get_events(sid: str, *, name=None, pid=None, status=None, category=None, search=None,
               limit: int = 50000, offset: int = 0, include_raw: bool = False) -> list[dict]:
    cols = [c for c in EVENT_COLS if include_raw or c != "raw"]
    q = f"SELECT {','.join(cols)} FROM events WHERE session_id=?"
    args: list = [sid]
    if name:
        q += " AND name=?"; args.append(name)
    if pid is not None:
        q += " AND pid=?"; args.append(pid)
    if status:
        q += " AND status=?"; args.append(status)
    if category:
        q += " AND category=?"; args.append(category)
    if search:
        q += " AND (name LIKE ? OR args LIKE ?)"; args += [f"%{search}%", f"%{search}%"]
    q += " ORDER BY ts, seq LIMIT ? OFFSET ?"
    args += [limit, offset]
    return [dict(r) for r in conn().execute(q, args).fetchall()]
