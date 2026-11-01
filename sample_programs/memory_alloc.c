/* memory_alloc.c — heap growth via brk(), large malloc via mmap(),
 * explicit anonymous mapping, mprotect() and munmap(). */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>

int main(void) {
    /* small allocations come from the heap (brk) */
    char *small = malloc(64 * 1024);
    memset(small, 'a', 64 * 1024);

    /* large allocations (>128 KiB by default) are served by mmap */
    char *large = malloc(4 * 1024 * 1024);
    memset(large, 'b', 4 * 1024 * 1024);

    size_t len = 2 * 1024 * 1024;
    char *region = mmap(NULL, len, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    if (region == MAP_FAILED) { perror("mmap"); return 1; }
    region[0] = 'x';
    mprotect(region, 4096, PROT_READ);      /* make first page read-only */
    munmap(region, len);

    /* a request that the kernel will refuse */
    void *huge = mmap(NULL, (size_t)1 << 46, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    if (huge == MAP_FAILED) perror("expected mmap failure");

    free(large);
    free(small);
    printf("memory demo complete\n");
    return 0;
}
