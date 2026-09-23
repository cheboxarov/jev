BIN := bin/jev
PLUGIN_BIN := $(HOME)/.claude/plugins/cache/jev/jev/0.1.0/bin/jev
OMP_PLUGIN_DIR := $(shell ls -dt "$(HOME)"/.omp/plugins/cache/plugins/jev___jev___*/ 2>/dev/null | head -1)
OMP_PLUGIN_BIN := $(OMP_PLUGIN_DIR)bin/jev

.PHONY: build test fmt vet install sync omp-sync clean

build: $(BIN)

$(BIN): $(shell find . -name '*.go')
	go build -o $(BIN) ./cmd/jev

test:
	go test ./...

fmt:
	gofmt -w .

vet:
	go vet ./...

# The plugin puts bin/ on PATH when it loads, so a build is the whole install.
# This target is for using jev as a plain CLI outside Claude Code.
install: build
	install -m 0755 $(BIN) $(HOME)/.local/bin/jev

# `claude plugin install` copies the binary into its own cache, so a rebuild
# here does not reach the copy the agent runs. This pushes it across without
# a version bump and reinstall.
sync: build
	@test -d "$(dir $(PLUGIN_BIN))" || { echo "plugin not installed at $(PLUGIN_BIN)"; exit 1; }
	install -m 0755 $(BIN) $(PLUGIN_BIN)
	@echo "updated $(PLUGIN_BIN)"

omp-sync: build
	@test -n "$(OMP_PLUGIN_DIR)" || { echo "omp plugin jev@jev is not installed"; exit 1; }
	install -d "$(OMP_PLUGIN_DIR)bin"
	install -m 0755 $(BIN) "$(OMP_PLUGIN_BIN)"
	@echo "updated $(OMP_PLUGIN_BIN)"

clean:
	rm -f $(BIN)
