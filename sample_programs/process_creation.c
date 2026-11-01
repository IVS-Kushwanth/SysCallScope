/* process_creation.c — fork N children; each reports its PID/PPID and exits
 * with a different status; the parent reaps them with waitpid(). */
#include <stdio.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>

int main(int argc, char **argv) {
    int n = argc > 1 ? atoi(argv[1]) : 3;
    if (n < 1) n = 1;
    if (n > 8) n = 8; /* keep demonstrations bounded */
    printf("parent pid=%d creating %d children\n", getpid(), n);
    fflush(stdout);
    for (int i = 0; i < n; i++) {
        pid_t pid = fork();
        if (pid == 0) {
            printf("  child %d: pid=%d ppid=%d\n", i, getpid(), getppid());
            fflush(stdout);
            usleep(10000 * (i + 1));
            _exit(i);
        }
    }
    int status;
    pid_t done;
    while ((done = wait(&status)) > 0)
        printf("reaped pid=%d exit=%d\n", done, WEXITSTATUS(status));
    return 0;
}
