import { motion, useReducedMotion } from "framer-motion";

const CALLS = [
  { name: "openat()", ret: "= 3", x: 8 },
  { name: "read()", ret: "= 312", x: 27 },
  { name: "mmap()", ret: "= 0x7f3a…", x: 45 },
  { name: "fork()", ret: "= 41821", x: 64 },
  { name: "write()", ret: "= 28", x: 82 },
];

/**
 * The signature visual: three privilege layers and the calls that cross them.
 * Requests (cobalt) descend through the system-call interface into the kernel;
 * results (lime) climb back to user space.
 */
export function HeroBoundary() {
  const reduce = useReducedMotion();
  const H = 232; // travel distance in px between user band and kernel band
  return (
    <div className="relative mx-auto w-full max-w-[560px] select-none" aria-label="Diagram: system calls travelling from a user application, through the system call interface, into the Linux kernel and back">
      <div className="relative h-[400px] overflow-hidden rounded-2xl border border-line bg-surface/80 backdrop-blur">
        {/* user band */}
        <div className="absolute inset-x-0 top-0 h-[112px] border-b border-line px-5 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-fog">User application</span>
            <span className="font-mono text-[11px] text-muted">ring 3</span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted/80">./parent_child  pid 41820</div>
        </div>
        {/* interface band */}
        <div className="absolute inset-x-0 top-[160px] h-[76px] border-y border-cobalt/50 bg-cobalt/[0.08] px-5 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-cobalt-300">System call interface</span>
            <span className="font-mono text-[11px] text-cobalt-300/80">syscall / sysret</span>
          </div>
          <motion.div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-lime to-transparent"
            animate={reduce ? undefined : { opacity: [0.15, 0.9, 0.15] }} transition={{ duration: 2.8, repeat: Infinity }} />
        </div>
        {/* kernel band */}
        <div className="absolute inset-x-0 bottom-0 h-[112px] border-t border-line bg-[linear-gradient(180deg,rgba(21,88,201,0.10),rgba(3,4,7,0))] px-5 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-fog">Linux kernel</span>
            <span className="font-mono text-[11px] text-muted">ring 0</span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted/80">vfs · scheduler · mm · drivers</div>
        </div>

        {/* lanes */}
        {CALLS.map((c) => (
          <div key={c.name} className="absolute top-[60px] h-[260px] w-px bg-gradient-to-b from-white/0 via-white/10 to-white/0" style={{ left: `calc(${c.x}% + 34px)` }} />
        ))}

        {CALLS.map((c, i) => (
          <div key={c.name} className="absolute top-[64px]" style={{ left: `${c.x}%` }}>
            <motion.div
              className="absolute left-0 whitespace-nowrap rounded-md border border-cobalt bg-cobalt/90 px-2 py-1 font-mono text-[11px] text-white shadow-[0_0_24px_rgba(21,88,201,0.55)]"
              initial={{ y: 0, opacity: 0 }}
              animate={reduce ? { y: 0, opacity: 1 } : { y: [0, 0, H, H], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2.2, times: [0, 0.1, 0.75, 1], repeat: Infinity, repeatDelay: 2.4, delay: i * 0.9, ease: "easeInOut" }}
            >
              {c.name}
            </motion.div>
            <motion.div
              className="absolute left-0 whitespace-nowrap rounded-md border border-lime/60 bg-ink px-2 py-1 font-mono text-[11px] text-lime"
              initial={{ y: H, opacity: 0 }}
              animate={reduce ? { opacity: 0 } : { y: [H, H, 0, 0], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2.2, times: [0, 0.12, 0.8, 1], repeat: Infinity, repeatDelay: 2.4, delay: i * 0.9 + 2.3, ease: "easeInOut" }}
            >
              {c.ret}
            </motion.div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between px-1 text-[11px] text-muted">
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-cobalt align-middle" />request enters kernel mode</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-lime align-middle" />result returns to user mode</span>
      </div>
    </div>
  );
}
