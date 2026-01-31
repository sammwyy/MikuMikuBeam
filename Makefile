BIN_DIR := bin
CLI_PKG := ./cmd/mmb-cli
SERVER_PKG := ./cmd/mmb-server
CLI_BIN := $(BIN_DIR)/mmb-cli
SERVER_BIN := $(BIN_DIR)/mmb-server
GO := go

.PHONY: all cli server run-cli run-server clean webclient build-all prepare

all: build-all

prepare:
	$(GO) mod tidy
	cd web-client && npm install --no-audit --no-fund

build-all: webclient cli server

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

cli: $(BIN_DIR)
	$(GO) build -o $(CLI_BIN) $(CLI_PKG)

server: $(BIN_DIR)
	$(GO) build -o $(SERVER_BIN) $(SERVER_PKG)

run-cli: cli
	$(CLI_BIN) $(ARGS)

run-server: server
	$(SERVER_BIN) $(ARGS)

webclient: $(BIN_DIR)
	cd web-client && npm install --no-audit --no-fund && npm run build
	rm -rf $(BIN_DIR)/web-client && mkdir -p $(BIN_DIR)/web-client
	mv web-client/dist/public/* $(BIN_DIR)/web-client/
	rm -rf web-client/dist

clean:
	rm -rf $(BIN_DIR)


