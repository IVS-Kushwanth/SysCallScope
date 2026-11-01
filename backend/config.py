"""Central configuration. Override with environment variables (see README)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
SAMPLE_DIR = PROJECT_DIR / "sample_programs"
SAMPLE_BIN_DIR = SAMPLE_DIR / "bin"
WORKSPACE_DIR = Path(os.getenv("SYSCALLSCOPE_WORKSPACE", PROJECT_DIR / "workspace")).resolve()
TRACE_DIR = WORKSPACE_DIR / "traces"
EXPORT_DIR = PROJECT_DIR / "exports"
DB_PATH = os.getenv("SYSCALLSCOPE_DB", str(BASE_DIR / "syscallscope.db"))

# Extra directories that users may trace executables from (colon separated).
# Only executables whose *real path* sits inside SAMPLE_BIN_DIR or one of these
# directories, AND whose name is in ALLOWED_SYSTEM_COMMANDS when they live in a
# system directory, can be traced.
EXTRA_ALLOWED_DIRS = [Path(p).resolve() for p in os.getenv("SYSCALLSCOPE_ALLOWED_DIRS", "").split(":") if p]

# Harmless system utilities that are useful for demonstrations.
ALLOWED_SYSTEM_COMMANDS = set(os.getenv(
    "SYSCALLSCOPE_SYSTEM_COMMANDS",
    "ls,cat,echo,pwd,date,whoami,uname,true,false,id,head,tail,wc,sleep,touch,mkdir,stat,hostname",
).split(","))
SYSTEM_BIN_DIRS = [Path("/usr/bin"), Path("/bin")]

TRACE_TIMEOUT_DEFAULT = int(os.getenv("SYSCALLSCOPE_TIMEOUT", "15"))
TRACE_TIMEOUT_MAX = 60
MAX_TRACE_BYTES = int(os.getenv("SYSCALLSCOPE_MAX_TRACE_MB", "25")) * 1024 * 1024
MAX_STDOUT_BYTES = 64 * 1024
MAX_EVENTS = int(os.getenv("SYSCALLSCOPE_MAX_EVENTS", "200000"))
MAX_ARGS = 16
MAX_ARG_LEN = 256
MAX_CONCURRENT_TRACES = 2
STRACE_STRING_SIZE = 64  # strace -s

ALLOW_ROOT = os.getenv("SYSCALLSCOPE_ALLOW_ROOT") == "1"
CORS_ORIGINS = os.getenv("SYSCALLSCOPE_CORS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

for d in (WORKSPACE_DIR, TRACE_DIR, EXPORT_DIR):
    d.mkdir(parents=True, exist_ok=True)
