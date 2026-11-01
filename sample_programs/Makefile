CC ?= gcc
CFLAGS ?= -O0 -g -Wall
PROGRAMS = hello file_reader file_writer process_creation memory_alloc parent_child

all: $(addprefix bin/,$(PROGRAMS))

bin/%: %.c | bin
	$(CC) $(CFLAGS) -o $@ $<

bin:
	mkdir -p bin

clean:
	rm -rf bin

.PHONY: all clean
