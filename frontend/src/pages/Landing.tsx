import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertOctagon, ArrowDown, BookOpen, Clock3, Cpu, FileDown, GitBranch, Github, HardDrive,
  Layers, Library, Menu, Network, Search, Terminal, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Background } from "../components/Background";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui";
import { HeroBoundary } from "../animations/HeroBoundary";
import { TerminalDemo } from "../animations/TerminalDemo";

const NAV = [
  { label: "Home", href: "#top" },
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "System Calls", href: "/app/syscalls" },
  { label: "Documentation", href: "/docs" },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const link = (l: (typeof NAV)[number], cls: string) =>
    l.href.startsWith("#") ? (
      <a key={l.label} href={l.href} className={cls} onClick={() => setOpen(false)}>{l.label}</a>
    ) : (
      <Link key={l.label} to={l.href} className={cls} onClick={() => setOpen(false)}>{l.label}</Link>
    );
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-line bg-ink/75 backdrop-blur-xl" : "border-b border-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((l) => link(l, "rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-fog"))}
        </nav>
        <div className="flex items-center gap-2">
          <Button size="sm" className="hidden sm:inline-flex" onClick={() => nav("/app")}>Launch dashboard</Button>
          <button className="rounded-md p-2 text-muted hover:text-fog md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-ink/95 backdrop-blur md:hidden">
            <div className="flex flex-col p-3">
              {NAV.map((l) => link(l, "rounded-md px-3 py-2.5 text-sm text-fog hover:bg-white/5"))}
              <Button className="mt-2" onClick={() => nav("/app")}>Launch dashboard</Button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function Hero() {
  const nav = useNavigate();
  return (
    <section id="top" className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-24 pt-32 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:px-8 lg:pt-40">
      <div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Operating systems project built on strace and ptrace
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="text-[clamp(2.4rem,5.2vw,4.1rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
          See beyond the application.
          <span className="mt-1 block text-cobalt-300">Explore the kernel.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted">
          Trace every system call. Visualize every process. Understand how applications communicate with the Linux kernel.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }} className="mt-9 flex flex-wrap gap-3">
          <Button size="lg" icon={Activity} onClick={() => nav("/app")}>Launch SyscallScope</Button>
          <Button size="lg" variant="secondary" icon={ArrowDown} onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
            Explore how it works
          </Button>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-10 max-w-[34rem]">
          <TerminalDemo />
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }} className="relative">
        {["execve()", "brk()", "clone()", "close()"].map((l, i) => (
          <motion.span key={l} className="absolute z-20 hidden rounded-md border border-line bg-card/90 px-2 py-1 font-mono text-[11px] text-muted backdrop-blur xl:block"
            style={{ left: ["-4%", "90%", "-6%", "86%"][i], top: ["-4%", "14%", "70%", "92%"][i] }}
            animate={{ y: [0, -8, 0] }} transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}>
            {l}
          </motion.span>
        ))}
        <HeroBoundary />
      </motion.div>
    </section>
  );
}

const FEATURES: { icon: LucideIcon; title: string; body: string; to: string }[] = [
  { icon: Activity, title: "Real-time system call tracing", body: "Runs a program under strace -f and streams each call over a WebSocket the moment it is written to the trace.", to: "/app/live" },
  { icon: GitBranch, title: "Process lifecycle visualization", body: "Rebuilds the parent–child tree from clone, execve, wait4 and exit events, separating what was observed from what is inferred.", to: "/app/processes" },
  { icon: Search, title: "System call explorer", body: "A searchable reference for 25 core calls with signatures, arguments, return values and the errors you will meet.", to: "/app/syscalls" },
  { icon: Clock3, title: "Execution timeline", body: "Every call placed on real -ttt timestamps with -T durations, grouped by PID, with slow calls flagged.", to: "/app/timeline" },
  { icon: AlertOctagon, title: "Error detection and analysis", body: "Failed calls grouped by errno: ENOENT, EACCES, EBADF, ENOMEM, with plain-language explanations.", to: "/app/files" },
  { icon: FileDown, title: "Exportable trace reports", body: "Download the structured trace as CSV or JSON, or a PDF report with statistics, process summary and timeline.", to: "/app/reports" },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">From a raw trace to a picture of the process</h2>
        <p className="mt-4 text-muted">strace output is precise but dense. SyscallScope parses it into structured events and shows each one in the view that explains it best.</p>
      </div>
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div key={f.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: i * 0.06, duration: 0.5 }} className="group relative bg-surface p-7 transition-colors hover:bg-card">
            <Link to={f.to} className="absolute inset-0" aria-label={f.title} />
            <div className="mb-5 grid h-10 w-10 place-items-center rounded-lg border border-cobalt/40 bg-cobalt/10 text-cobalt-300 transition-all group-hover:border-lime/50 group-hover:text-lime">
              <f.icon size={19} className="transition-transform duration-300 group-hover:scale-110" />
            </div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { icon: Terminal, title: "Select a program", body: "Pick one of six sample C programs or an approved utility like ls or cat." },
  { icon: Activity, title: "Capture with strace", body: "strace -f -ttt -T records every call, child process, timestamp and duration." },
  { icon: GitBranch, title: "Reconstruct execution", body: "The parser merges resumed calls, tracks file descriptors and rebuilds the process tree." },
  { icon: Layers, title: "Visualize kernel interactions", body: "Charts, timelines and graphs show where the program crossed into the kernel." },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">How it works</h2>
      <div className="relative mt-12 grid gap-6 md:grid-cols-4">
        <div className="absolute left-0 right-0 top-6 hidden h-px md:block">
          <div className="h-full w-full bg-line" />
          <motion.div className="absolute top-0 h-px w-24 bg-gradient-to-r from-transparent via-lime to-transparent"
            animate={{ left: ["0%", "92%"] }} transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }} />
        </div>
        {STEPS.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} className="relative">
            <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl border border-cobalt/50 bg-ink font-mono text-sm text-cobalt-300">
              {i + 1}
            </div>
            <div className="mt-5 flex items-center gap-2 font-semibold"><s.icon size={16} className="text-lime" />{s.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

const LAYERS: { icon: LucideIcon; name: string; mode: string; body: string; example: string }[] = [
  { icon: Terminal, name: "User application", mode: "User mode", body: "Your program's own code. It cannot touch hardware, other processes' memory or the file system directly.", example: "fd = open(\"sample.txt\", O_RDONLY);" },
  { icon: Library, name: "Library functions", mode: "User mode", body: "glibc wraps each request: it places the system-call number in rax and arguments in rdi, rsi, rdx, r10, r8, r9.", example: "mov $257, %eax   ; __NR_openat" },
  { icon: Cpu, name: "System call interface", mode: "Mode switch", body: "The syscall instruction switches the CPU from ring 3 to ring 0 and jumps to the kernel's entry point, which looks the number up in sys_call_table.", example: "syscall  →  entry_SYSCALL_64" },
  { icon: Network, name: "Linux kernel", mode: "Kernel mode", body: "The kernel validates arguments, checks permissions and does the work: path lookup in the VFS, allocating a descriptor. The result goes back in rax.", example: "do_sys_openat2() → fd 3" },
  { icon: HardDrive, name: "Hardware and system resources", mode: "Kernel mode", body: "Drivers talk to disks, memory and devices. sysret returns to user mode at the instruction after syscall.", example: "page cache / block device" },
];

function Architecture() {
  const [active, setActive] = useState(2);
  return (
    <section id="architecture" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">One call, five layers</h2>
          <p className="mt-4 max-w-lg leading-relaxed text-muted">
            A system call is the only doorway from an unprivileged program into the kernel. Select a layer to see what happens there when a program opens a file.
          </p>
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
              className="panel mt-8 p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{LAYERS[active].name}</h3>
                <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] ${active < 2 ? "bg-white/5 text-muted" : active === 2 ? "bg-lime/10 text-lime" : "bg-cobalt/15 text-cobalt-300"}`}>{LAYERS[active].mode}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-fog/85">{LAYERS[active].body}</p>
              <code className="mt-4 block rounded-lg border border-line bg-ink px-3 py-2 font-mono text-xs text-cobalt-300">{LAYERS[active].example}</code>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="relative space-y-2.5" role="list">
          {LAYERS.map((l, i) => (
            <div key={l.name} role="listitem">
              {i === 2 && <div className="my-3 flex items-center gap-3 text-[11px] text-lime"><span className="h-px flex-1 bg-lime/40" />user / kernel boundary<span className="h-px flex-1 bg-lime/40" /></div>}
              <button onClick={() => setActive(i)} aria-pressed={active === i}
                className={`flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all ${active === i ? "border-cobalt bg-cobalt/15 shadow-[0_0_40px_-12px_rgba(21,88,201,0.8)]" : "border-line bg-surface hover:border-white/20"}`}>
                <l.icon size={18} className={active === i ? "text-lime" : "text-muted"} />
                <span className="flex-1 font-medium">{l.name}</span>
                <span className="font-mono text-[11px] text-muted">{i < 2 ? "ring 3" : i === 2 ? "ring 3 → 0" : "ring 0"}</span>
              </button>
              {i < LAYERS.length - 1 && i !== 1 && (
                <div className="ml-8 flex h-3 items-center"><div className="h-full w-px bg-cobalt/40" /></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-ink/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            An interactive system call tracing and process lifecycle visualizer. Built as an academic Operating Systems project to show how user-space programs talk to the Linux kernel.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Technology</h4>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            <li>React, TypeScript, Tailwind CSS</li>
            <li>Framer Motion, Plotly.js, React Flow</li>
            <li>Python, FastAPI, SQLite</li>
            <li>strace on Ubuntu / WSL2</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Project</h4>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><a href="https://github.com/your-username/SyscallScope" className="inline-flex items-center gap-2 text-muted hover:text-fog"><Github size={14} />GitHub repository</a></li>
            <li><Link to="/docs" className="inline-flex items-center gap-2 text-muted hover:text-fog"><BookOpen size={14} />Documentation</Link></li>
            <li><Link to="/app" className="inline-flex items-center gap-2 text-muted hover:text-fog"><Activity size={14} />Dashboard</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">
        Academic project for the Operating Systems course. Traces are captured locally; nothing leaves your machine.
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-screen">
      <Background />
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Architecture />
      </main>
      <Footer />
    </div>
  );
}
