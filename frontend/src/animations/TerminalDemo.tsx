import { useEffect, useState } from "react";

const LINES = [
  { t: "$ strace -f -ttt -T ./parent_child", c: "text-fog" },
  { t: '41820 execve("./parent_child", …) = 0 <0.000412>', c: "text-cobalt-300" },
  { t: '41820 openat(AT_FDCWD, "sample.txt", O_RDONLY) = 3', c: "text-fog/85" },
  { t: "41820 read(3, \"SyscallScope sample…\", 4096) = 312", c: "text-fog/85" },
  { t: "41820 clone(…|SIGCHLD) = 41821", c: "text-lime" },
  { t: '41821 write(4, "hello from child…", 23) = 23', c: "text-fog/85" },
  { t: '41820 openat(AT_FDCWD, "config/missing.conf", …) = -1 ENOENT', c: "text-danger" },
  { t: "41821 +++ exited with 0 +++", c: "text-cobalt-300" },
];

/** Typewriter terminal; loops through a short, realistic trace excerpt. */
export function TerminalDemo() {
  const [shown, setShown] = useState(0);
  const [chars, setChars] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(LINES.length); return; }
    let line = 0, ch = 0;
    const id = window.setInterval(() => {
      if (line >= LINES.length) {
        ch++;
        if (ch > 40) { line = 0; ch = 0; setShown(0); setChars(0); }
        return;
      }
      ch += line === 0 ? 1 : 4;
      if (ch >= LINES[line].t.length) { line++; ch = 0; setShown(line); }
      setChars(ch);
    }, 28);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-ink/90 shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-2 font-mono text-[11px] text-muted">trace.log</span>
      </div>
      <div className="h-[196px] overflow-hidden p-3 font-mono text-[11.5px] leading-[1.75]">
        {LINES.slice(0, shown).map((l) => <div key={l.t} className={`${l.c} truncate`}>{l.t}</div>)}
        {shown < LINES.length && (
          <div className={`${LINES[shown].c} truncate`}>
            {LINES[shown].t.slice(0, chars)}
            <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulseDot bg-lime" />
          </div>
        )}
      </div>
    </div>
  );
}
