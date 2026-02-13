# Miku Miku Beam 💥⚡ (Network Stresser)

[![Docker Image](https://github.com/miguerubsk/MikuMikuBeam/actions/workflows/docker-image.yml/badge.svg?branch=dev)](https://github.com/miguerubsk/MikuMikuBeam/actions/workflows/docker-image.yml)

A fun and visually appealing stress testing server with a **Miku-themed** frontend, where you can configure and run attacks while enjoying a banger song in the background! 🎤✨

![Screenshot](docs/screenshot.png)

## Features 🎉

- 🐳 **Docker Ready**: MMB is ready to be built and run in a Docker container.
- 🌐 **Real-time Attack Visualization**: View your attack's progress and statistics in real-time as it runs. 🔥
- 🎶 **Miku-themed UI**: A cute and vibrant design with Miku's vibe to make the process more fun. Includes a banger song to keep you pumped! 🎧
- 🧑‍💻 **Configurable Attack Parameters**: Easily set the attack method, packet size, duration, and packet delay via the frontend interface.
- 🛠️ **Multi-threaded Attack Handling**: The server processes attacks using multiple goroutines for optimal performance and scalability.
- 📊 **Live Stats**: Track the success and failure of each attack in real-time. See how many packets are sent and whether they succeed or fail.
- 🖼️ **Aesthetic Design**: A visually cute interface to make your experience enjoyable. 🌸
- 📡 **Attack Methods:**:
  - `HTTP Flood` - Send random HTTP requests
  - `HTTP Bypass` - Send HTTP requests that mimics real requests (Redirects, cookies, headers, resources...)
  - `HTTP Slowloris` - Send slow HTTP requests and keep the connection open
  - `Minecraft Ping` - Send Minecraft ping/motd requests
  - `TCP Flood` - Send random TCP packets
- 🚀 **CLI Support**: Run attacks from the command line with colored output and real-time stats
- 🔄 **Multi-client Support**: Multiple web clients can run attacks simultaneously
- 🎯 **Per-client Attack Management**: Each client has its own isolated attack instance

## Project Structure 🏗️

The project is divided into four main components:

### 📱 **CLI** (`cmd/mmb-cli/`)

Command-line interface for running attacks from terminal:

- Colored output with real-time statistics
- `--verbose` flag for detailed attack logs
- `--no-proxy` flag to run without proxies
- `--threads` flag to control concurrency

### ⚙️ **Core** (`internal/`)

The engine and attack implementations:

- **`engine/`** - Attack coordination and management
- **`attacks/`** - Individual attack method implementations
  - `http/` - HTTP-based attacks (flood, bypass, slowloris)
  - `tcp/` - TCP-based attacks (flood)
  - `game/` - Game-specific attacks (minecraft ping)
- **`config/`** - Configuration management
- **`proxy/`** - Proxy loading and filtering
- **`netutil/`** - Network utilities (HTTP/TCP clients with proxy support)

### 🌐 **Server** (`cmd/mmb-server/`)

Web server with Socket.IO support:

- REST API endpoints (`/attacks`, `/configuration`)
- Real-time communication via Socket.IO
- Static file serving for web client
- Multi-client attack management

### 🎨 **Web Client** (`web-client/`)

React-based frontend:

- Modern UI with Miku theme
- Real-time attack visualization
- Socket.IO integration for live updates
- Configuration management interface

## Quick Start 🚀

```bash
# 1. Clone and setup
git clone https://github.com/sammwyy/mikumikubeam.git
cd mikumikubeam

# 2. Install dependencies
make prepare

# 3. Create required files
echo "http://proxy1:8080" > data/proxies.txt
echo "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" > data/uas.txt

# 4. Build and run
make all && make run-server

# 5. Open http://localhost:3000 in your browser
```

## Setup 🛠️

### Prerequisites 📦

Make sure you have the following installed:

- Go (v1.21 or above) 🐹
- Node.js (v18 or above) 🌱
- npm (Node Package Manager) 📦

### Development Mode 🔧

1. Clone this repository:

   ```bash
   git clone https://github.com/sammwyy/mikumikubeam.git
   cd mikumikubeam
   ```

2. Install dependencies:

   ```bash
   make prepare
   ```

3. Create the necessary files:
   - `data/proxies.txt` - List of proxies (one per line).
   - `data/uas.txt` - List of user agents (one per line).

4. Build everything (web client + binaries):

   ```bash
   make all
   ```

5. Run the server:

   ```bash
   make run-server
   ```

   - The **web interface** runs on `http://localhost:3000`.
   - The **API** runs on `http://localhost:3000/api`.

---

### Production Mode 💥

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/sammwyy/mikumikubeam.git
   cd mikumikubeam
   ```

2. Install dependencies:

   ```bash
   make prepare
   ```

3. Build everything:

   ```bash
   make all
   ```

4. Start the server in production mode:

   ```bash
   ./bin/mmb-server
   ```

   In production mode, both the **frontend** and **backend** are served on the same port (`http://localhost:3000`).

> Don't forget to add the necessary files `data/proxies.txt` and `data/uas.txt`.

## Usage ⚙️

### Web Interface 🌐

Once the server is up and running, you can interact with it via the web interface:

1. **Start Attack**:
   - Set up the attack parameters: target URL, attack method (HTTP Flood, Slowloris, TCP, etc...), packet size, duration, and delay.
   - Press "Start Attack" to initiate the stress test.

2. **Stop Attack**:
   - Press "Stop Attack" to terminate the ongoing attack.

3. **Multiple Clients**:
   - Open multiple browser tabs/windows to run different attacks simultaneously
   - Each client maintains its own attack instance

### CLI Interface 💻

Run attacks directly from the command line:

```bash
# Basic attack
./bin/mmb-cli attack http_flood http://example.com

# With custom parameters
./bin/mmb-cli attack http_bypass http://example.com --duration 120 --delay 100 --packet-size 1024 --threads 8

# Verbose mode (shows detailed logs)
./bin/mmb-cli attack tcp_flood http://example.com --verbose

# Without proxies
./bin/mmb-cli attack minecraft_ping minecraft.example.com:25565 --no-proxy
```

### Example Request

```json
{
  "target": "http://example.com",
  "attackMethod": "http_flood",
  "packetSize": 512,
  "duration": 60,
  "packetDelay": 500,
  "threads": 4
}
```

## Adding Proxies and User-Agents

Access to the `data/proxies.txt` and `data/uas.txt` can now be done fully in the web interface. Click the text button to the right of the beam button to open up the editor.

![AnnotatedImage](docs/annotated-button.png)

## Multi-threaded Attack Handling 🔧💡

Each attack runs in multiple goroutines (threads), ensuring optimal performance and scalability. The attack workers are dynamically loaded based on the selected attack method (HTTP, TCP, etc...).

### Attack Methods Implementation:

- **HTTP Flood**: Random GET/POST requests with configurable payloads
- **HTTP Bypass**: Browser-mimicking requests with realistic headers and cookies
- **HTTP Slowloris**: Slow HTTP requests that keep connections open
- **TCP Flood**: Raw TCP packet flooding with random data
- **Minecraft Ping**: Minecraft server status requests

## Makefile Commands 🛠️

```bash
make prepare      # Install all dependencies (go mod tidy + npm install)
make all          # Build everything (web client + CLI + server)
make webclient    # Build React frontend only
make cli          # Build CLI binary only
make server       # Build server binary only
make run-cli      # Run CLI with example attack
make run-server   # Run web server
make clean        # Clean build artifacts
```

### Quick Start Commands:

```bash
# Complete setup (recommended)
make prepare && make all && make run-server

# Or step by step
make prepare      # Install dependencies
make webclient    # Build frontend
make cli          # Build CLI
make server       # Build server
make run-server   # Start server
```

## To-Do 📝

- Add more attack methods:
  - UDP 🌐
  - DNS 📡
  - And more! 🔥

- Enhance attack statistics and reporting for better real-time monitoring. 📊

## Contributing 💖

Feel free to fork the repo and open pull requests with new attack protocols, bug fixes, or improvements. If you have an idea for a new feature, please share it! 😄

### Adding New Attack Methods ⚡

To extend the server with new attack methods, you can create new worker files and add them to the attack registry.

For example:

1. Create a new attack worker in `internal/attacks/your_protocol/`:

```go
package yourprotocol

import (
    "context"
    core "github.com/sammwyy/mikumikubeam/internal/engine"
)

type yourWorker struct{}

func NewYourWorker() *yourWorker { return &yourWorker{} }

func (w *yourWorker) Fire(ctx context.Context, params core.AttackParams, p core.Proxy, ua string, logCh chan<- core.AttackStats) error {
    // Your attack implementation here
    core.SendAttackLogIfVerbose(logCh, p, params.Target, params.Verbose)
    return nil
}
```

2. Register the attack in `internal/engine/registry.go`:

```go
func NewRegistry() Registry {
    return &registry{
        workers: map[AttackKind]AttackWorker{
            AttackHTTPFlood:     http.NewFloodWorker(),
            AttackHTTPBypass:    http.NewBypassWorker(),
            AttackHTTPSlowloris: http.NewSlowlorisWorker(),
            AttackTCPFlood:      tcp.NewFloodWorker(),
            AttackMinecraftPing: game.NewPingWorker(),
            AttackYourProtocol:  yourprotocol.NewYourWorker(), // Add your attack
        },
    }
}
```

3. Add the attack method to the web client's attack list.

---

### FAQs ❓

**1. What operating system does MMB support?**

> **Windows**, **Linux**, **Mac** and **Android (untested)**

**2. It crashes on startup, giving a "concurrently" error**

> This is a Node.js/React issue. Make sure you have Node.js v18+ installed and run `npm install` in the `web-client` directory.

**3. I go to "http://localhost:3000" and nothing appears.**

> Make sure you've built the web client with `make build-webclient` and the server is running with `./bin/mmb-server`.

**4. Requests fail to be sent to the target server (Read timeout and variations)**

> You must put the corresponding proxies in the file `data/proxies.txt`. On each line, put a different proxy that will be used to perform the attack. The format must be the following:
>
> - `protocol://user:password@host:port` (Proxy with authentication)
> - `protocol://host:port`
> - `host:port` (Uses http as default protocol)
> - `host` (Uses 8080 as default port)

**5. How do I run attacks without proxies?**

> Use the `--no-proxy` flag in CLI or set `ALLOW_NO_PROXY=true` environment variable for the server.

**6. Can I run multiple attacks simultaneously?**

> Yes! The web server supports multiple clients running different attacks at the same time. Each client maintains its own attack instance.

**7. The web client doesn't load or shows errors**

> Make sure you've run `make all` to build the web client. The web client needs to be built before the server can serve it.

**8. CLI shows "No proxies available" error**

> Either add proxies to `data/proxies.txt` or use the `--no-proxy` flag to run without proxies.

**9. Build fails with "module not found" errors**

> Run `go mod tidy` to download all Go dependencies, then `cd web-client && npm install` for Node.js dependencies.

---

## License 📝

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Disclaimer 🚨

Please note that this project is for educational purposes only and should not be used for malicious purposes.

---

### (｡♥‿♥｡) Happy Hacking 💖🎶
