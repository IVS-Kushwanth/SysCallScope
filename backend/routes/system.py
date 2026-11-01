"""Environment, sample programs and demo-session endpoints."""
import asyncio
import time
import uuid

from fastapi import APIRouter, HTTPException

import database as db
from demo_data import DEMO_SCENARIOS, demo_events
from models import DemoRequest
from samples import sample_status
from tracer import RUNS, DemoReplay, environment

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health")
def health():
    return {"ok": True, "time": time.time(), "environment": environment()}


@router.get("/programs")
def programs():
    return {"programs": sample_status()}


@router.get("/demo/scenarios")
def scenarios():
    return {"scenarios": DEMO_SCENARIOS}


@router.post("/demo")
async def create_demo(req: DemoRequest):
    sc = next((s for s in DEMO_SCENARIOS if s["id"] == req.scenario), None)
    if not sc:
        raise HTTPException(404, "Unknown demo scenario")
    events = demo_events(req.scenario)
    sid = "demo-" + uuid.uuid4().hex[:8]
    db.create_session({
        "id": sid, "name": sc["name"], "mode": "demo", "program": sc["program"],
        "program_id": sc["id"], "argv": [], "command": f"strace -f -ttt -T -o trace.log {sc['program']}  (simulated)",
        "status": "running" if req.replay else "completed", "started_at": time.time(),
        "ended_at": None if req.replay else time.time(), "exit_code": None if req.replay else 0,
        "stdout": "[parent] pid=41820 starting\n[child] wrote 23 bytes to pipe\n[parent] child 41821 exited (0)\nexec from child\n[parent] done\n",
    })
    if req.replay:
        run = DemoReplay(sid, events, req.speed)
        RUNS[sid] = run
        run.task = asyncio.create_task(run.run())
    else:
        db.insert_events(sid, events)
    return db.get_session(sid)
