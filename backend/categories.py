"""System-call categorisation used by the parser and analyzers."""

FILE = {
    "open", "openat", "openat2", "creat", "read", "pread64", "readv", "preadv", "write",
    "pwrite64", "writev", "pwritev", "close", "close_range", "lseek", "access", "faccessat",
    "faccessat2", "stat", "lstat", "fstat", "newfstatat", "statx", "unlink", "unlinkat",
    "rename", "renameat", "renameat2", "mkdir", "mkdirat", "rmdir", "getdents", "getdents64",
    "dup", "dup2", "dup3", "fcntl", "ioctl", "readlink", "readlinkat", "chdir", "fchdir",
    "getcwd", "pipe", "pipe2", "fsync", "fdatasync", "ftruncate", "truncate", "chmod",
    "fchmod", "fchmodat", "chown", "fchown", "fchownat", "statfs", "fstatfs", "sendfile",
    "copy_file_range", "symlink", "symlinkat", "link", "linkat", "utimensat", "fadvise64",
    "poll", "ppoll", "select", "pselect6", "epoll_create1", "epoll_ctl", "epoll_wait",
    "epoll_pwait", "inotify_init1", "inotify_add_watch", "flock",
}
PROCESS = {
    "fork", "vfork", "clone", "clone3", "execve", "execveat", "wait4", "waitid", "exit",
    "exit_group", "getpid", "getppid", "gettid", "set_tid_address", "setsid", "setpgid",
    "getpgrp", "getpgid", "prctl", "arch_prctl", "set_robust_list", "get_robust_list",
    "sched_yield", "sched_getaffinity", "sched_setaffinity", "nanosleep", "clock_nanosleep",
    "futex", "rseq", "prlimit64", "getrlimit", "setrlimit", "getrusage", "exited", "killed",
    "restart_syscall", "pidfd_open", "unshare", "setns",
}
MEMORY = {"mmap", "munmap", "brk", "mprotect", "mremap", "madvise", "mlock", "munlock",
          "msync", "mincore", "membarrier", "pkey_mprotect"}
SIGNAL = {"kill", "tkill", "tgkill", "rt_sigaction", "rt_sigprocmask", "rt_sigreturn",
          "rt_sigsuspend", "rt_sigtimedwait", "sigaltstack", "pause", "alarm", "signalfd4"}
NETWORK = {"socket", "connect", "bind", "listen", "accept", "accept4", "sendto", "recvfrom",
           "sendmsg", "recvmsg", "shutdown", "getsockname", "getpeername", "setsockopt",
           "getsockopt", "socketpair"}
INFO = {"getuid", "geteuid", "getgid", "getegid", "uname", "sysinfo", "getrandom", "time",
        "gettimeofday", "clock_gettime", "clock_getres", "times", "getgroups", "getresuid",
        "getresgid", "capget", "getcpu", "sched_getparam", "personality"}

CATEGORIES = ["file", "process", "memory", "signal", "network", "info", "other"]


def categorize(name: str) -> str:
    if name in FILE:
        return "file"
    if name in PROCESS:
        return "process"
    if name in MEMORY:
        return "memory"
    if name in SIGNAL or name.startswith("SIG"):
        return "signal"
    if name in NETWORK:
        return "network"
    if name in INFO:
        return "info"
    return "other"


CREATION_CALLS = {"fork", "vfork", "clone", "clone3"}
OPEN_CALLS = {"open", "openat", "openat2", "creat"}
READ_CALLS = {"read", "pread64", "readv", "preadv"}
WRITE_CALLS = {"write", "pwrite64", "writev", "pwritev"}
PATH_PROBE_CALLS = {"access", "faccessat", "faccessat2", "stat", "lstat", "newfstatat",
                    "statx", "readlink", "readlinkat", "unlink", "unlinkat", "mkdir", "mkdirat",
                    "rmdir", "chdir"}
