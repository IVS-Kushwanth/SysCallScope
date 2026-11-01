# SyscallScope

**See beyond the application. Explore the kernel.**

SyscallScope is a system call tracing and process lifecycle visualizer, built as an academic Operating Systems project. It runs a program under `strace`, parses every system call into structured data, stores it in SQLite, and shows it in an animated web dashboard: a live event stream, a process tree, a timeline, file and memory analysis, and exportable reports.

The focus is the boundary between user space and the Linux kernel: what a program asks the kernel to do, when, for how long, and whether it worked.

---

## Requirements

| Component | Version |
|---|---|
| OS | Ubuntu 22.04/24.04, or Ubuntu on **WSL2** (Windows 10/11) |
| strace | 5.x or 6.x |
| gcc / make | from `build-essential` |
| Python | 3.10+ |
| Node.js | 18+ (20 LTS recommended) |

Live tracing needs Linux. strace uses the Linux `ptrace` interface and does **not** work on native Windows or macOS. On those systems you can still run the dashboard in **Demo mode**.

### Windows users: install WSL2 first

Open PowerShell as Administrator:

```powershell
wsl --install -d Ubuntu
```

Restart, open the **Ubuntu** app, create a user, then follow the steps below *inside Ubuntu*. Keep the project inside the Linux file system (for example `~/SyscallScope`), not under `/mnt/c/...`, or file watching and npm will be slow.

---

## Quick start (scripted)

```bash
unzip SyscallScope.zip
cd SyscallScope
bash scripts/setup.sh     # installs strace, gcc, Node, Python deps; compiles samples
bash scripts/run.sh       # starts backend :8000 and frontend :5173
```

Open **http://localhost:5173**.

## Manual setup

```bash
# 1. System packages
sudo apt update
sudo apt install -y strace build-essential python3-venv python3-pip curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Compile the sample programs
make -C sample_programs

# 3. Backend (terminal 1). Run as your normal user, never with sudo.
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 4. Frontend (terminal 2)
cd frontend
npm install
npm run dev
```

- App: http://localhost:5173
- Interactive API docs: http://localhost:8000/docs

### Production build (optional)

```bash
cd frontend
npm run build                 # output in frontend/dist
VITE_API_URL=http://127.0.0.1:8000 npm run build   # if serving dist without the Vite proxy
```

---

## Using the app

1. Open the dashboard and choose a data source in the header: **Live Linux** or **Demo**.
2. **Start Tracing**: pick one of the six sample programs (or an approved utility such as `ls`), set arguments and timeout, and press *Start tracing*.
3. **Live Trace** streams calls as they happen over a WebSocket. Filter by name, PID, status or category; click a line to inspect it.
4. Explore the other views: **Overview**, **Process Explorer**, **Execution Timeline**, **File Operations**, **Memory Analysis**, **System Call Explorer**.
5. **Reports**: export the session as CSV, JSON or a PDF report, or delete old sessions.

### Sample programs (`sample_programs/`)

| Program | Demonstrates |
|---|---|
| `hello` | loader activity, a single `write`, `exit_group` |
| `file_reader` | `openat`, `read`, `write`, `close`, and an `ENOENT` failure |
| `file_writer` | file creation, `fsync`, `stat`, `unlink`, an `EEXIST` failure |
| `process_creation` | `clone` (fork) ×N, `getpid`/`getppid`, `wait4`, non-zero exit codes |
| `memory_alloc` | `brk` heap growth, `mmap`, `mprotect`, `munmap`, an `ENOMEM` failure |
| `parent_child` | `pipe2`, fork, blocked `read` that resumes, `execve` of `/bin/echo`, `SIGCHLD` |

Each trace runs in its own folder under `workspace/sessions/<id>/`, which contains a copy of `sample.txt`.

### Demo mode

Demo mode loads a pre-written trace in genuine `strace -f -ttt -T` format and runs it through the same parser as real traces. Demo sessions are stored with `mode='demo'`, labelled **DEMO DATA** everywhere (including exports), and never mixed with live sessions. *Replay with live animation* streams the demo through the WebSocket pipeline so the live view can be shown on any machine.

---

## How it works

```
strace -f -ttt -T -s 64 -o trace.log -- ./program args
         │   │    │
         │   │    └─ time spent in each call
         │   └─ epoch timestamps with microseconds
         └─ follow forked children (PID prefix on every line)
```

1. **tracer.py** validates the request and starts strace with an argument array (no shell) in a new process group, with CPU/file-size limits and a timeout.
2. It tails `trace.log` while the program runs; **parser.py** turns each line into an event. It handles `<unfinished ...>` / `<... resumed>` pairs, failed calls with errno, `= ?` returns, signals (`--- SIGCHLD ---`) and exits (`+++ exited with 0 +++`).
3. Events are batched into **SQLite** (`database.py`) and pushed to subscribed browsers over a **WebSocket**.
4. **analyzer.py** and **process_tree.py** compute statistics, file-descriptor tracking (including inheritance at fork and `O_CLOEXEC` at exec), memory regions, and the process tree on demand.
5. **exporter.py** produces CSV, JSON and PDF (ReportLab) reports.

### Project structure

```
SyscallScope/
├── backend/
│   ├── main.py            FastAPI app, CORS, startup
│   ├── config.py          paths, limits, allow-lists (env-configurable)
│   ├── tracer.py          safe strace execution, live tailing, demo replay
│   ├── parser.py          incremental strace parser
│   ├── categories.py      syscall → category mapping
│   ├── analyzer.py        stats, file activity, memory activity
│   ├── process_tree.py    process lifecycle reconstruction
│   ├── database.py        SQLite sessions + events
│   ├── exporter.py        CSV / JSON / PDF
│   ├── demo_data.py       demo trace (strace text format)
│   ├── samples.py         approved sample programs
│   ├── models.py          request models
│   ├── routes/            REST + WebSocket endpoints
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/         landing, docs
│       ├── dashboard/     layout + 10 dashboard pages
│       ├── components/    UI kit, charts, background, event inspector
│       ├── animations/    hero visual, terminal demo
│       ├── context/       session / live-stream state
│       ├── services/      API client and types
│       └── lib/           formatting, syscall reference catalog
├── sample_programs/       C sources, Makefile, sample.txt
├── scripts/               setup.sh, run.sh
├── exports/
└── README.md
```

### REST API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | environment, strace and ptrace status |
| GET | `/api/programs` | approved sample programs |
| POST | `/api/traces` | start a trace `{program_id \| executable, args, follow_forks, timeout}` |
| GET | `/api/traces?mode=live\|demo` | list sessions |
| GET | `/api/traces/{id}` | session status |
| POST | `/api/traces/{id}/stop` | stop a running trace |
| DELETE | `/api/traces/{id}` | delete a session |
| GET | `/api/traces/{id}/events` | events (filters: `name`, `pid`, `status`, `category`, `search`) |
| GET | `/api/traces/{id}/processes` | process tree |
| GET | `/api/traces/{id}/files` | file activity |
| GET | `/api/traces/{id}/memory` | memory activity |
| GET | `/api/traces/{id}/stats` | analysis statistics |
| GET | `/api/traces/{id}/export/{csv\|json\|pdf}` | download report |
| WS | `/api/traces/{id}/live` | live event stream |
| POST | `/api/demo` | create a demo session `{replay, speed}` |

---

## Security and execution safety

- **No shell.** Programs start via `asyncio.create_subprocess_exec` with argument arrays; `shell=True` is never used.
- **Allow-listed executables only:** compiled sample programs, directories in `SYSCALLSCOPE_ALLOWED_DIRS`, or utilities named in `SYSCALLSCOPE_SYSTEM_COMMANDS` (default: `ls, cat, echo, pwd, date, whoami, uname, true, false, id, head, tail, wc, sleep, touch, mkdir, stat, hostname`). Paths are checked after `realpath`, so symlinks cannot escape.
- **Argument validation:** at most 16 arguments of 256 characters; no NUL bytes, no `..`, no `~`, and absolute paths only inside the session workspace or `sample_programs/`.
- **Limits:** timeout (default 15 s, max 60 s), `RLIMIT_CPU`, `RLIMIT_FSIZE`, no core dumps, 25 MB trace cap, 200,000 events per session, 64 KB captured output, 2 concurrent traces.
- **Stop:** each run has its own process group; Stop sends SIGTERM then SIGKILL to strace and the tracee together.
- **No root:** the backend exits if started as root. Traced programs run with your normal user privileges.

| Variable | Default | Meaning |
|---|---|---|
| `SYSCALLSCOPE_TIMEOUT` | 15 | default timeout (seconds) |
| `SYSCALLSCOPE_MAX_TRACE_MB` | 25 | trace file size limit |
| `SYSCALLSCOPE_MAX_EVENTS` | 200000 | events stored per session |
| `SYSCALLSCOPE_ALLOWED_DIRS` | (empty) | extra `:`-separated executable directories |
| `SYSCALLSCOPE_SYSTEM_COMMANDS` | see above | approved `/usr/bin` utilities |
| `SYSCALLSCOPE_CORS` | localhost:5173 | allowed browser origins |
| `SYSCALLSCOPE_ALLOW_ROOT` | unset | `1` only inside a throwaway container |

---

## Troubleshooting

**"strace is not installed"**: `sudo apt install -y strace`

**"ptrace: Operation not permitted"**: check `cat /proc/sys/kernel/yama/ptrace_scope`.
- `0` or `1`: fine. SyscallScope traces programs it starts itself, which `1` (Ubuntu's default) allows.
- `2`: run `sudo sysctl kernel.yama.ptrace_scope=1`.
- `3`: ptrace is disabled until reboot.
- In Docker, start the container with `--cap-add=SYS_PTRACE`.

**"Sample is not compiled yet"**: `make -C sample_programs`

**Dashboard says "Backend not reachable"**: start the backend on port 8000 (`uvicorn main:app --port 8000` in `backend/`, with the venv activated).

**"Refusing to run SyscallScope as root"**: don't use `sudo` for uvicorn; run it as your normal user.

**Port already in use**: `uvicorn main:app --port 8001` and change the proxy target in `frontend/vite.config.ts`.

**Fonts look different offline**: the UI loads IBM Plex from Google Fonts and falls back to system fonts without internet.

---

## Limitations (what strace cannot show)

- **Scheduler states are not observable.** "Running" and "waiting" in the Process Explorer are inferred from the last observed call and are marked as inferred.
- **Memory:** `mmap`/`brk` show address-space requests. Physical pages are allocated lazily on first access, and allocations malloc serves from memory it already owns make no system call.
- **Durations include ptrace overhead**, so traced programs run slower than normal.
- **vDSO calls** (e.g. `clock_gettime`) usually never enter the kernel and do not appear.
- Strings are truncated to 64 bytes (`-s 64`) to keep traces small.

---

## Technology

React 18, TypeScript, Tailwind CSS 3, Framer Motion, Plotly.js, React Flow (@xyflow/react), Lucide icons, Vite · Python, FastAPI, Uvicorn, ReportLab, SQLite · strace on Ubuntu / WSL2.

Academic project for the Operating Systems course.
