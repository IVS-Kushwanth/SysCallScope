import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Background } from "../components/Background";
import { Logo } from "../components/Logo";

function Code({ children }: { children: string }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-ink p-4 font-mono text-[12.5px] leading-relaxed text-cobalt-300">{children}</pre>;
}
function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line py-10">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-fog/85">{children}</div>
    </section>
  );
}

const TOC = [
  ["setup", "Install and run"], ["modes", "Live tracing and demo mode"], ["ptrace", "ptrace permissions"],
  ["security", "Execution safety"], ["reading", "Reading a trace"], ["limits", "What strace cannot show"], ["api", "REST API"],
];

export default function Docs() {
  return (
    <div className="relative min-h-screen">
      <Background density={0.5} />
      <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fog"><ArrowLeft size={15} />Back to home</Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block" aria-label="Documentation sections">
          <ul className="sticky top-24 space-y-1 text-sm">
            {TOC.map(([id, t]) => <li key={id}><a className="block rounded-md px-2 py-1.5 text-muted hover:bg-white/5 hover:text-fog" href={`#${id}`}>{t}</a></li>)}
          </ul>
        </nav>
        <article className="max-w-[72ch]">
          <h1 className="text-4xl font-semibold tracking-tight">Documentation</h1>
          <p className="mt-3 text-muted">How to install SyscallScope on Ubuntu or WSL2, capture traces safely, and interpret what you see.</p>

          <Sec id="setup" title="Install and run">
            <p>SyscallScope needs Linux because strace relies on the Linux ptrace interface. On Windows, install WSL2 with Ubuntu and run everything inside it.</p>
            <Code>{`sudo apt update
sudo apt install -y strace build-essential python3-venv python3-pip
# Node.js 18+ (20 LTS recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs`}</Code>
            <p>Compile the sample programs, then start the backend and frontend in two terminals:</p>
            <Code>{`make -C sample_programs

cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

cd frontend
npm install
npm run dev     # open http://localhost:5173`}</Code>
          </Sec>

          <Sec id="modes" title="Live tracing and demo mode">
            <p><b>Live Linux tracing</b> runs a real program under <code className="font-mono text-cobalt-300">strace -f -ttt -T</code> and streams events to the browser.</p>
            <p><b>Sample demonstration</b> loads a pre-written trace in genuine strace format, parsed by the same parser. Every demo session is stored separately and labelled DEMO DATA; live and demo events are never mixed. Switch modes in the dashboard header or in Settings.</p>
          </Sec>

          <Sec id="ptrace" title="ptrace permissions">
            <p>strace attaches with <code className="font-mono">ptrace(2)</code>. Ubuntu's Yama security module controls who may trace whom through <code className="font-mono">/proc/sys/kernel/yama/ptrace_scope</code>:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>0</b>: you may trace any process you own.</li>
              <li><b>1</b> (Ubuntu default): you may trace only your own descendants. SyscallScope always launches the program itself, so this works.</li>
              <li><b>2</b>: only processes with CAP_SYS_PTRACE may trace. Set it back to 1 with <code className="font-mono">sudo sysctl kernel.yama.ptrace_scope=1</code>.</li>
              <li><b>3</b>: ptrace is disabled until reboot.</li>
            </ul>
            <p>Docker containers usually block ptrace unless started with <code className="font-mono">--cap-add=SYS_PTRACE</code>.</p>
          </Sec>

          <Sec id="security" title="Execution safety">
            <ul className="list-disc space-y-1 pl-5">
              <li>No shell is involved: programs are started with argument arrays, never <code className="font-mono">shell=True</code>.</li>
              <li>Only sample programs, directories listed in <code className="font-mono">SYSCALLSCOPE_ALLOWED_DIRS</code>, and a short list of harmless utilities can be traced.</li>
              <li>Arguments are length-limited; <code className="font-mono">..</code> and absolute paths outside the session workspace are rejected.</li>
              <li>Each trace has a timeout (max 60 s), CPU and file-size limits, and its own process group so Stop kills strace and the program together.</li>
              <li>The backend refuses to run as root. Traced programs inherit your normal user privileges and run in a per-session folder under <code className="font-mono">workspace/</code>.</li>
            </ul>
          </Sec>

          <Sec id="reading" title="Reading a trace">
            <Code>{`41820 1730361601.004213 openat(AT_FDCWD, "sample.txt", O_RDONLY) = 3 <0.000012>
│     │                 │                                          │   └ -T: time spent in the call
│     │                 │                                          └ return value (a new fd)
│     │                 └ call name and decoded arguments
│     └ -ttt: wall-clock timestamp in seconds since the epoch
└ -f: PID of the process that made the call`}</Code>
            <p>When two processes interleave, strace splits a blocking call into <code className="font-mono">read(3, &lt;unfinished ...&gt;</code> and <code className="font-mono">&lt;... read resumed&gt;</code>. SyscallScope merges these into one event that starts at the first timestamp.</p>
          </Sec>

          <Sec id="limits" title="What strace cannot show">
            <ul className="list-disc space-y-1 pl-5">
              <li>Scheduler states (runnable vs running) are invisible. "Running" and "waiting" in the process view are inferences, and are labelled so.</li>
              <li>mmap and brk show address-space requests. Physical pages are allocated lazily on first access, which strace does not observe.</li>
              <li>Durations include ptrace overhead, so traced programs run noticeably slower than normal.</li>
              <li>vDSO calls such as clock_gettime often never enter the kernel and do not appear.</li>
            </ul>
          </Sec>

          <Sec id="api" title="REST API">
            <p>Interactive API documentation is served by FastAPI at <code className="font-mono">http://localhost:8000/docs</code>.</p>
            <Code>{`GET    /api/health                      environment, strace and ptrace status
GET    /api/programs                    approved sample programs
POST   /api/traces                      start a trace {program_id | executable, args, follow_forks, timeout}
GET    /api/traces?mode=live|demo       previous sessions
GET    /api/traces/{id}                 session status
POST   /api/traces/{id}/stop            stop a running trace
GET    /api/traces/{id}/events          structured events (filters: name, pid, status, category, search)
GET    /api/traces/{id}/processes       reconstructed process tree
GET    /api/traces/{id}/files           file and descriptor activity
GET    /api/traces/{id}/memory          memory mapping activity
GET    /api/traces/{id}/stats           analysis statistics
GET    /api/traces/{id}/export/{fmt}    csv | json | pdf
WS     /api/traces/{id}/live            live event stream
POST   /api/demo                        create a demo session {replay, speed}`}</Code>
          </Sec>
        </article>
      </div>
    </div>
  );
}
