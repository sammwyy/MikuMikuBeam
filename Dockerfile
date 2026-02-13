# Builder Stage
FROM golang:1.24-alpine AS builder

# Install build dependencies
# make: to run Makefile commands
# nodejs, npm: to build the web client
RUN apk add --no-cache make nodejs npm

WORKDIR /app

# Copy all files
COPY . .

# Install dependencies (Go modules & NPM packages)
RUN make prepare

# Build everything (Server, CLI, Web Client)
RUN make all

# Final Stage
FROM alpine:latest
WORKDIR /app

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Copy artifacts from builder
# The Makefile puts everything in the 'bin' directory
COPY --from=builder /app/bin ./bin

# Create data directory
RUN mkdir -p data && touch data/proxies.txt data/uas.txt

# Expose server port
EXPOSE 3000

# Run the server
CMD ["./bin/mmb-server"]
