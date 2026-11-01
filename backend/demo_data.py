"""
Demonstration traces.

These are written in genuine `strace -f -ttt -T` text format and then run
through the real parser, so demo mode exercises exactly the same pipeline as
live tracing. Every session created from here is stored with mode='demo' and
is labelled DEMO DATA in the UI. Demo events are never mixed with live ones.
"""
from __future__ import annotations

import random
import time

from parser import parse_lines

LIBS = [("/etc/ld.so.cache", 0x5b2e), ("/lib/x86_64-linux-gnu/libc.so.6", 0x1e2a50)]


class _W:
    def __init__(self, t0: float, seed: int):
        self.t = t0
        self.lines: list[str] = []
        self.rng = random.Random(seed)

    def call(self, pid, text, result, dur=None, gap=None):
        self.t += gap if gap is not None else self.rng.uniform(0.00002, 0.00012)
        d = dur if dur is not None else self.rng.uniform(0.000003, 0.000040)
        self.lines.append(f"{pid} {self.t:.6f} {text} = {result} <{d:.6f}>")
        self.t += d

    def raw(self, pid, text, gap=0.00002):
        self.t += gap
        self.lines.append(f"{pid} {self.t:.6f} {text}")

    def loader(self, pid, prog, argv):
        self.call(pid, f'execve("{prog}", {argv}, 0x7ffd5e8c1a38 /* 24 vars */)', "0", 0.000412, 0)
        self.call(pid, "brk(NULL)", "0x55d4c3a2e000")
        self.call(pid, "arch_prctl(0x3001 /* ARCH_??? */, 0x7ffd5e8c19e0)", "-1 EINVAL (Invalid argument)")
        self.call(pid, "mmap(NULL, 8192, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0)", "0x7f3a1c6f4000")
        self.call(pid, 'access("/etc/ld.so.preload", R_OK)', "-1 ENOENT (No such file or directory)")
        self.call(pid, 'openat(AT_FDCWD, "/etc/ld.so.cache", O_RDONLY|O_CLOEXEC)', "3")
        self.call(pid, 'newfstatat(3, "", {st_mode=S_IFREG|0644, st_size=23342, ...}, AT_EMPTY_PATH)', "0")
        self.call(pid, "mmap(NULL, 23342, PROT_READ, MAP_PRIVATE, 3, 0)", "0x7f3a1c6ee000")
        self.call(pid, "close(3)", "0")
        self.call(pid, 'openat(AT_FDCWD, "/lib/x86_64-linux-gnu/libc.so.6", O_RDONLY|O_CLOEXEC)', "3")
        self.call(pid, 'read(3, "\\177ELF\\2\\1\\1\\3\\0\\0\\0\\0\\0\\0\\0\\0\\3\\0>\\0\\1\\0\\0\\0P\\237\\2\\0\\0\\0\\0\\0"..., 832)', "832")
        self.call(pid, 'pread64(3, "\\6\\0\\0\\0\\4\\0\\0\\0@\\0\\0\\0\\0\\0\\0\\0@\\0\\0\\0\\0\\0\\0\\0@\\0\\0\\0\\0\\0\\0\\0"..., 784, 64)', "784")
        self.call(pid, 'newfstatat(3, "", {st_mode=S_IFREG|0755, st_size=2125328, ...}, AT_EMPTY_PATH)', "0")
        self.call(pid, "mmap(NULL, 2170256, PROT_READ, MAP_PRIVATE|MAP_DENYWRITE, 3, 0)", "0x7f3a1c4dc000")
        self.call(pid, "mmap(0x7f3a1c504000, 1605632, PROT_READ|PROT_EXEC, MAP_PRIVATE|MAP_FIXED|MAP_DENYWRITE, 3, 0x28000)", "0x7f3a1c504000")
        self.call(pid, "mmap(0x7f3a1c68c000, 323584, PROT_READ, MAP_PRIVATE|MAP_FIXED|MAP_DENYWRITE, 3, 0x1b0000)", "0x7f3a1c68c000")
        self.call(pid, "mmap(0x7f3a1c6db000, 24576, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_FIXED|MAP_DENYWRITE, 3, 0x1fe000)", "0x7f3a1c6db000")
        self.call(pid, "close(3)", "0")
        self.call(pid, "arch_prctl(ARCH_SET_FS, 0x7f3a1c4d9740)", "0")
        self.call(pid, "set_tid_address(0x7f3a1c4d9a10)", str(pid))
        self.call(pid, "set_robust_list(0x7f3a1c4d9a20, 24)", "0")
        self.call(pid, "rseq(0x7f3a1c4da060, 0x20, 0, 0x53053053)", "0")
        self.call(pid, "mprotect(0x7f3a1c6db000, 16384, PROT_READ)", "0")
        self.call(pid, "mprotect(0x55d4c2a1f000, 4096, PROT_READ)", "0")
        self.call(pid, "prlimit64(0, RLIMIT_STACK, NULL, {rlim_cur=8192*1024, rlim_max=RLIM64_INFINITY})", "0")
        self.call(pid, "munmap(0x7f3a1c6ee000, 23342)", "0")
        self.call(pid, "getrandom(\"\\x5e\\x1d\\x8a\\x4c\\x9b\\x33\\x12\\xe7\", 8, GRND_NONBLOCK)", "8")
        self.call(pid, "brk(NULL)", "0x55d4c3a2e000")
        self.call(pid, "brk(0x55d4c3a4f000)", "0x55d4c3a4f000")


def parent_child_demo(seed: int = 7) -> str:
    w = _W(time.time() - 120, seed)
    P, C1, C2 = 41820, 41821, 41822
    w.loader(P, "./parent_child", '["./parent_child"]')
    w.call(P, 'newfstatat(1, "", {st_mode=S_IFCHR|0620, st_rdev=makedev(0x88, 0), ...}, AT_EMPTY_PATH)', "0")
    w.call(P, "getpid()", str(P))
    w.call(P, 'write(1, "[parent] pid=41820 starting\\n", 28)', "28")
    w.call(P, 'openat(AT_FDCWD, "sample.txt", O_RDONLY)', "3")
    w.call(P, 'read(3, "SyscallScope sample file.\\nEvery line"..., 4096)', "312")
    w.call(P, 'read(3, "", 4096)', "0")
    w.call(P, "close(3)", "0")
    w.call(P, 'openat(AT_FDCWD, "config/missing.conf", O_RDONLY)', "-1 ENOENT (No such file or directory)")
    w.call(P, "pipe2([3, 4], 0)", "0")
    w.call(P, "clone(child_stack=NULL, flags=CLONE_CHILD_CLEARTID|CLONE_CHILD_SETTID|SIGCHLD, child_tidptr=0x7f3a1c4d9a10)", str(C1), 0.000118)
    # child 1 runs while parent blocks in read
    w.raw(P, "read(3,  <unfinished ...>")
    w.call(C1, "set_robust_list(0x7f3a1c4d9a20, 24)", "0")
    w.call(C1, "close(3)", "0")
    w.call(C1, "getpid()", str(C1))
    w.call(C1, "getppid()", str(P))
    w.call(C1, 'write(4, "hello from child 41821\\n", 23)', "23")
    w.call(C1, "close(4)", "0")
    w.call(C1, 'write(1, "[child] wrote 23 bytes to pipe\\n", 31)', "31")
    w.call(C1, "nanosleep({tv_sec=0, tv_nsec=20000000}, NULL)", "0", 0.020112)
    w.raw(C1, "exit_group(0)                     = ?")
    w.raw(C1, "+++ exited with 0 +++")
    w.raw(P, '<... read resumed>"hello from child 41821\\n", 64) = 23 <0.020871>')
    w.raw(P, "--- SIGCHLD {si_signo=SIGCHLD, si_code=CLD_EXITED, si_pid=41821, si_uid=1000, si_status=0, si_utime=0, si_stime=0} ---")
    w.call(P, "close(3)", "0")
    w.call(P, "close(4)", "0")
    w.call(P, "wait4(41821, [{WIFEXITED(s) && WEXITSTATUS(s) == 0}], 0, NULL)", str(C1))
    w.call(P, 'write(1, "[parent] child 41821 exited (0)\\n", 33)', "33")
    w.call(P, "clone(child_stack=NULL, flags=CLONE_CHILD_CLEARTID|CLONE_CHILD_SETTID|SIGCHLD, child_tidptr=0x7f3a1c4d9a10)", str(C2), 0.000104)
    w.raw(P, "wait4(41822,  <unfinished ...>")
    w.call(C2, "set_robust_list(0x7f3a1c4d9a20, 24)", "0")
    w.call(C2, 'execve("/usr/local/bin/echo", ["echo", "exec", "from", "child"], 0x7ffd5e8c1a38 /* 24 vars */)', "-1 ENOENT (No such file or directory)")
    w.call(C2, 'execve("/usr/bin/echo", ["echo", "exec", "from", "child"], 0x7ffd5e8c1a38 /* 24 vars */)', "0", 0.000398)
    for text, res in [
        ("brk(NULL)", "0x5612f0b1d000"),
        ('access("/etc/ld.so.preload", R_OK)', "-1 ENOENT (No such file or directory)"),
        ('openat(AT_FDCWD, "/etc/ld.so.cache", O_RDONLY|O_CLOEXEC)', "3"),
        ("mmap(NULL, 23342, PROT_READ, MAP_PRIVATE, 3, 0)", "0x7f8b10a2e000"),
        ("close(3)", "0"),
        ('openat(AT_FDCWD, "/lib/x86_64-linux-gnu/libc.so.6", O_RDONLY|O_CLOEXEC)', "3"),
        ('read(3, "\\177ELF\\2\\1\\1\\3\\0\\0\\0\\0\\0\\0\\0\\0\\3\\0>\\0\\1\\0\\0\\0P\\237\\2\\0\\0\\0\\0\\0"..., 832)', "832"),
        ("mmap(NULL, 2170256, PROT_READ, MAP_PRIVATE|MAP_DENYWRITE, 3, 0)", "0x7f8b1081c000"),
        ("mmap(0x7f8b10844000, 1605632, PROT_READ|PROT_EXEC, MAP_PRIVATE|MAP_FIXED|MAP_DENYWRITE, 3, 0x28000)", "0x7f8b10844000"),
        ("close(3)", "0"),
        ("mprotect(0x7f8b10a1b000, 16384, PROT_READ)", "0"),
        ("munmap(0x7f8b10a2e000, 23342)", "0"),
        ("brk(NULL)", "0x5612f0b1d000"),
        ("brk(0x5612f0b3e000)", "0x5612f0b3e000"),
        ('openat(AT_FDCWD, "/usr/lib/locale/locale-archive", O_RDONLY|O_CLOEXEC)', "-1 ENOENT (No such file or directory)"),
        ('write(1, "exec from child\\n", 16)', "16"),
        ("close(1)", "0"),
        ("close(2)", "0"),
    ]:
        w.call(C2, text, res)
    w.raw(C2, "exit_group(0)                     = ?")
    w.raw(C2, "+++ exited with 0 +++")
    w.raw(P, "<... wait4 resumed>[{WIFEXITED(s) && WEXITSTATUS(s) == 0}], 0, NULL) = 41822 <0.002914>")
    w.raw(P, "--- SIGCHLD {si_signo=SIGCHLD, si_code=CLD_EXITED, si_pid=41822, si_uid=1000, si_status=0, si_utime=0, si_stime=0} ---")
    # memory demonstration in the parent
    w.call(P, "mmap(NULL, 1048576, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0)", "0x7f3a1c3d8000", 0.000021)
    w.call(P, "mprotect(0x7f3a1c3d8000, 4096, PROT_NONE)", "0")
    w.call(P, "munmap(0x7f3a1c3d8000, 1048576)", "0", 0.000035)
    w.call(P, "mmap(NULL, 137438953472, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS|MAP_NORESERVE, -1, 0)", "-1 ENOMEM (Cannot allocate memory)")
    w.call(P, 'openat(AT_FDCWD, "report.txt", O_WRONLY|O_CREAT|O_TRUNC, 0644)', "3")
    w.call(P, 'write(3, "children=2 status=ok\\n", 21)', "21")
    w.call(P, "fsync(3)", "0", 0.004212)
    w.call(P, "close(3)", "0")
    w.call(P, 'openat(AT_FDCWD, "/root/secret", O_RDONLY)', "-1 EACCES (Permission denied)")
    w.call(P, "close(9)", "-1 EBADF (Bad file descriptor)")
    w.call(P, 'write(1, "[parent] done\\n", 14)', "14")
    w.raw(P, "exit_group(0)                     = ?")
    w.raw(P, "+++ exited with 0 +++")
    return "\n".join(w.lines) + "\n"


def demo_events(scenario: str = "parent_child") -> list[dict]:
    text = parent_child_demo()
    return [e.to_dict() for e in parse_lines(text.splitlines())]


DEMO_SCENARIOS = [{"id": "parent_child", "name": "Parent–Child Process (demo)",
                   "program": "./parent_child",
                   "description": "Dynamic loading, a pipe between parent and child, fork + execve, waits, signals, memory mapping and several failed calls."}]
