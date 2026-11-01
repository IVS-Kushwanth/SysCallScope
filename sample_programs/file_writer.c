/* file_writer.c — create a file, write lines, fsync, stat, and unlink a temp file. */
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

int main(int argc, char **argv) {
    const char *path = argc > 1 ? argv[1] : "output.txt";
    int fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) { perror("open"); return 1; }
    for (int i = 1; i <= 5; i++) {
        char line[64];
        int len = snprintf(line, sizeof line, "line %d written by write()\n", i);
        write(fd, line, (size_t)len);
    }
    fsync(fd);
    close(fd);

    struct stat st;
    if (stat(path, &st) == 0)
        printf("%s is %lld bytes\n", path, (long long)st.st_size);

    int tmp = open("scratch.tmp", O_WRONLY | O_CREAT | O_EXCL, 0600);
    if (tmp >= 0) { write(tmp, "temp\n", 5); close(tmp); }
    unlink("scratch.tmp");
    /* EEXIST demonstration: create the same file again with O_EXCL */
    int again = open(path, O_WRONLY | O_CREAT | O_EXCL, 0644);
    if (again < 0) perror("expected EEXIST");
    return 0;
}
