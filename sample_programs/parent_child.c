/* parent_child.c — pipe between parent and child, then fork + execve. */
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    int fds[2];
    if (pipe(fds) < 0) { perror("pipe"); return 1; }
    printf("[parent] pid=%d starting\n", getpid());
    fflush(stdout);

    pid_t a = fork();
    if (a == 0) {
        close(fds[0]);
        char msg[64];
        int len = snprintf(msg, sizeof msg, "hello from child %d\n", getpid());
        write(fds[1], msg, (size_t)len);
        close(fds[1]);
        _exit(0);
    }
    close(fds[1]);
    char buf[64] = {0};
    ssize_t n = read(fds[0], buf, sizeof buf - 1);
    close(fds[0]);
    printf("[parent] received %zd bytes: %s", n, buf);
    waitpid(a, NULL, 0);

    pid_t b = fork();
    if (b == 0) {
        char *argv[] = {"echo", "exec", "from", "child", NULL};
        execv("/bin/echo", argv);
        perror("execv");
        _exit(127);
    }
    int status;
    waitpid(b, &status, 0);
    printf("[parent] child %d exited with %d\n", b, WEXITSTATUS(status));
    return 0;
}
