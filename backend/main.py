"""
SyscallScope API — FastAPI application entry point.

Run (from backend/):  uvicorn main:app --reload --port 8000
"""
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ALLOW_ROOT, CORS_ORIGINS
import database as db
from routes import system, traces

if hasattr(os, "geteuid") and os.geteuid() == 0 and not ALLOW_ROOT:
    sys.exit("Refusing to run SyscallScope as root. Start it as a normal user "
             "(set SYSCALLSCOPE_ALLOW_ROOT=1 only inside a disposable container).")

app = FastAPI(title="SyscallScope API", version="1.0.0",
              description="System call tracing and process lifecycle analysis built on strace.")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
app.include_router(system.router)
app.include_router(traces.router)


@app.on_event("startup")
def _startup():
    db.conn()
    # Sessions left 'running' by a previous crash can never finish.
    for s in db.list_sessions():
        if s["status"] == "running":
            db.update_session(s["id"], status="stopped", error="Server restarted while tracing.")


@app.get("/")
def root():
    return {"name": "SyscallScope API", "docs": "/docs"}
