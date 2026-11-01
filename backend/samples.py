"""Registry of the approved demonstration programs in sample_programs/."""
from config import SAMPLE_BIN_DIR, SAMPLE_DIR

SAMPLES = [
    {"id": "hello", "name": "Hello World", "source": "hello.c",
     "description": "Prints one line. The smallest possible trace: loader, write(), exit_group().",
     "focus": ["execve", "brk", "mmap", "write", "exit_group"], "default_args": []},
    {"id": "file_reader", "name": "File Reader", "source": "file_reader.c",
     "description": "Opens sample.txt, reads it in chunks, echoes it, then tries a file that does not exist (ENOENT).",
     "focus": ["openat", "read", "write", "close", "ENOENT"], "default_args": ["sample.txt"]},
    {"id": "file_writer", "name": "File Writer", "source": "file_writer.c",
     "description": "Creates output.txt, writes several lines, fsyncs, stats and removes a temporary file.",
     "focus": ["openat", "write", "fsync", "newfstatat", "unlink"], "default_args": ["output.txt"]},
    {"id": "process_creation", "name": "Process Creation", "source": "process_creation.c",
     "description": "Forks three children that each report getpid()/getppid() and exit with different codes.",
     "focus": ["clone", "getpid", "getppid", "wait4", "exit_group"], "default_args": ["3"]},
    {"id": "memory_alloc", "name": "Memory Allocation", "source": "memory_alloc.c",
     "description": "Grows the heap with brk(), maps anonymous memory with mmap(), changes protection and unmaps it.",
     "focus": ["brk", "mmap", "mprotect", "munmap"], "default_args": []},
    {"id": "parent_child", "name": "Parent–Child Process", "source": "parent_child.c",
     "description": "Parent creates a pipe, forks a child that writes into it, then forks a child that execs /bin/echo.",
     "focus": ["pipe2", "clone", "execve", "wait4", "SIGCHLD"], "default_args": []},
]


def get_sample(sample_id: str):
    for s in SAMPLES:
        if s["id"] == sample_id:
            return s
    return None


def sample_status() -> list[dict]:
    out = []
    for s in SAMPLES:
        binp = SAMPLE_BIN_DIR / s["id"]
        out.append({**s, "binary": str(binp), "compiled": binp.exists(),
                    "source_code": (SAMPLE_DIR / s["source"]).read_text() if (SAMPLE_DIR / s["source"]).exists() else ""})
    return out
