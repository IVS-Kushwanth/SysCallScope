/* hello.c — the smallest interesting trace: loader, one write(), exit_group(). */
#include <stdio.h>

int main(void) {
    printf("Hello from user space! The kernel will do the actual writing.\n");
    return 0;
}
