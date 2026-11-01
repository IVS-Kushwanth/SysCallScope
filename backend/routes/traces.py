"""Trace session endpoints: start/stop, events, analyses, exports, live stream."""
import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import Response

import database as db
from analyzer import compute_stats, file_activity, memory_activity
from exporter import to_csv, to_json, to_pdf
from models import TraceRequest
from process_tree import build_process_tree
from tracer import RUNS, TraceError, start_trace

router = APIRouter(prefix="/api/traces", tags=["traces"])


def _session_or_404(sid: str) -> dict:
    s = db.get_session(sid)
    if not s:
        raise HTTPException(404, "Trace session not found")
    return s


@router.get("")
def list_traces(mode: Optional[str] = Query(None, pattern="^(live|demo)$")):
    return {"sessions": db.list_sessions(mode)}


@router.post("")
async def create_trace(req: TraceRequest):
    try:
        return await start_trace(req.program_id, req.executable, req.args, req.follow_forks, req.timeout)
    except TraceError as e:
        raise HTTPException(e.status, str(e))


@router.get("/{sid}")
def get_trace(sid: str):
    s = _session_or_404(sid)
    s["live"] = sid in RUNS
    return s


@router.post("/{sid}/stop")
async def stop_trace(sid: str):
    _session_or_404(sid)
    run = RUNS.get(sid)
    if not run:
        return {"stopped": False, "message": "Trace is not running."}
    await run.stop()
    try:
        await asyncio.wait_for(run.done.wait(), timeout=5)
    except asyncio.TimeoutError:
        pass
    return {"stopped": True, "session": db.get_session(sid)}


@router.delete("/{sid}")
async def delete_trace(sid: str):
    _session_or_404(sid)
    run = RUNS.get(sid)
    if run:
        await run.stop()
    db.delete_session(sid)
    return {"deleted": sid}


@router.get("/{sid}/events")
def events(sid: str, name: Optional[str] = None, pid: Optional[int] = None,
           status: Optional[str] = None, category: Optional[str] = None,
           search: Optional[str] = None, limit: int = Query(20000, le=200000), offset: int = 0,
           raw: bool = False):
    _session_or_404(sid)
    return {"events": db.get_events(sid, name=name, pid=pid, status=status, category=category,
                                    search=search, limit=limit, offset=offset, include_raw=raw)}


@router.get("/{sid}/processes")
def processes(sid: str):
    _session_or_404(sid)
    return build_process_tree(db.get_events(sid), session_running=sid in RUNS)


@router.get("/{sid}/files")
def files(sid: str):
    _session_or_404(sid)
    return file_activity(db.get_events(sid))


@router.get("/{sid}/memory")
def memory(sid: str):
    _session_or_404(sid)
    return memory_activity(db.get_events(sid))


@router.get("/{sid}/stats")
def stats(sid: str):
    _session_or_404(sid)
    return compute_stats(db.get_events(sid))


@router.get("/{sid}/export/{fmt}")
def export(sid: str, fmt: str):
    s = _session_or_404(sid)
    evs = db.get_events(sid)
    base = f"syscallscope-{'demo-' if s['mode'] == 'demo' else ''}{sid}"
    if fmt == "csv":
        return Response(to_csv(evs), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="{base}.csv"'})
    st = compute_stats(evs)
    pt = build_process_tree(evs)
    if fmt == "json":
        return Response(to_json(s, evs, st, pt), media_type="application/json",
                        headers={"Content-Disposition": f'attachment; filename="{base}.json"'})
    if fmt == "pdf":
        return Response(to_pdf(s, evs, st, pt), media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="{base}.pdf"'})
    raise HTTPException(400, "Format must be csv, json or pdf")


@router.websocket("/{sid}/live")
async def live(ws: WebSocket, sid: str):
    await ws.accept()
    s = db.get_session(sid)
    if not s:
        await ws.send_json({"type": "error", "message": "Trace session not found"})
        await ws.close()
        return
    run = RUNS.get(sid)
    q = run.bus.subscribe() if run else None
    try:
        backlog = db.get_events(sid)
        last_seq = backlog[-1]["seq"] if backlog else 0
        await ws.send_json({"type": "snapshot", "session": s, "events": backlog[-5000:]})
        if not q:
            await ws.send_json({"type": "status", "status": s["status"]})
            await ws.close()
            return
        while True:
            msg = await q.get()
            if msg["type"] == "events":
                msg = {**msg, "events": [e for e in msg["events"] if e["seq"] > last_seq]}
                if not msg["events"]:
                    continue
                last_seq = msg["events"][-1]["seq"]
            await ws.send_json(msg)
            if msg["type"] == "status" and msg["status"] != "running":
                await ws.close()
                return
    except WebSocketDisconnect:
        pass
    finally:
        if run and q:
            run.bus.unsubscribe(q)
