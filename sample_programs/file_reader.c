/* file_reader.c — openat(), read() in chunks, write() to stdout, close(),
 * then a deliberate failure: opening a file that does not exist (ENOENT). */
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char **argv) {
    const char *path = argc > 1 ? argv[1] : "sample.txt";
    char buf[128];
    int fd = open(path, O_RDONLY);
    if (fd < 0) {
        fprintf(stderr, "open(%s) failed: %s\n", path, strerror(errno));
        return 1;
    }
    ssize_t n;
    while ((n = read(fd, buf, sizeof buf)) > 0)
        write(STDOUT_FILENO, buf, (size_t)n);
    close(fd);

    int bad = open("does_not_exist.txt", O_RDONLY);
    if (bad < 0)
        fprintf(stderr, "expected failure: %s\n", strerror(errno));
    return 0;
}
