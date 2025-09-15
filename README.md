# Miku Miku Beam 💥⚡ (Network Stresser)

A fun and visually appealing stress testing server with a **Miku-themed** frontend, where you can configure and run attacks while enjoying a banger song in the background! 🎤✨

![Screenshot](docs/screenshot.png)

## ✨ What's New in v1.0.0

- 🔒 **Enhanced Security**: Added Helmet.js, CORS protection, and rate limiting
- 🚀 **Performance Improvements**: Multi-stage Docker builds, compression, and caching
- 🧪 **Testing Framework**: Integrated Vitest with comprehensive test setup
- 📊 **Better Monitoring**: Health checks, structured logging, and error handling
- 🐳 **Production Ready**: Optimized Docker setup with Nginx reverse proxy
- 🔧 **Developer Experience**: Improved TypeScript config, ESLint rules, and build process

## Features 🎉

- 🐳 **Docker Ready**: MMB is ready to be built and run in a Docker container with production-grade setup.
- 🌐 **Real-time Attack Visualization**: View your attack's progress and statistics in real-time as it runs. 🔥
- 🎶 **Miku-themed UI**: A cute and vibrant design with Miku's vibe to make the process more fun. Includes a banger song to keep you pumped! 🎧
- 🧑‍💻 **Configurable Attack Parameters**: Easily set the attack method, packet size, duration, and packet delay via the frontend interface.
- 🛠️ **Worker-Based Attack Handling**: The server processes attacks in separate workers for optimal performance and scalability.
- 📊 **Live Stats**: Track the success and failure of each attack in real-time. See how many packets are sent and whether they succeed or fail.
- 🖼️ **Aesthetic Design**: A visually cute interface to make your experience enjoyable. 🌸
- 🔒 **Security Features**: Rate limiting, CORS protection, security headers, and input validation.
- 📡 **Attack Methods**:
  - `HTTP Flood` - Send random HTTP requests
  - `HTTP Bypass` - Send HTTP requests that mimics real requests (Redirects, cookies, headers, resources...)
  - `HTTP Slowloris` - Send HTTP requests and keep the connection open
  - `Minecraft Ping` - Send Minecraft ping/motd requests
  - `TCP Flood` - Send random TCP packets

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/sammwyy/mikumikubeam.git
cd mikumikubeam

# Start with Docker Compose
docker-compose up -d

# Access the application
# Frontend: http://localhost
# API: http://localhost/api
```

### Manual Setup

#### Prerequisites 📦

- Node.js (v18 or above) 🌱
- npm (Node Package Manager) 📦
- Redis (for production)

#### Development Mode 🔧

1. Clone this repository:

   ```bash
   git clone https://github.com/sammwyy/mikumikubeam.git
   cd mikumikubeam
   ```

2. Install the required dependencies:

   ```bash
   npm install
   ```

3. Create the necessary files:
   - `data/proxies.txt` - List of proxies.
   - `data/uas.txt` - List of user agents.

4. Run the server in development mode:

   ```bash
   npm run dev
   ```

   - The **frontend** runs on `http://localhost:5173`.
   - The **backend** runs on `http://localhost:3000`.

5. Run tests:

   ```bash
   npm run test
   npm run test:ui
   ```

---

#### Production Mode 💥

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/sammwyy/mikumikubeam.git
   cd mikumikubeam
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. Start the server in production mode:

   ```bash
   npm run start
   ```

   In production mode, both the **frontend** and **backend** are served on the same port (`http://localhost:3000`).

> Don't forget to add the necessary files `data/proxies.txt` and `data/uas.txt`.

## 🧪 Testing

The project includes a comprehensive testing setup with Vitest:

```bash
# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix
```

## 🔧 Development Scripts

```bash
npm run dev          # Start development server (client + server)
npm run dev:client   # Start only client development server
npm run dev:server   # Start only server development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run clean        # Clean build artifacts
npm run start        # Start production server
```

## 🐳 Docker Deployment

### Production Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Custom Configuration

The Docker setup includes:
- **Multi-stage builds** for optimized image size
- **Nginx reverse proxy** with SSL support
- **Redis** for caching and session storage
- **Health checks** and automatic restarts
- **Volume persistence** for data and logs

## 📊 Monitoring & Health

- **Health Check**: `GET /health`
- **Real-time Logs**: Structured logging with timestamps
- **Performance Metrics**: Built-in monitoring endpoints
- **Error Tracking**: Comprehensive error handling and reporting

## 🔒 Security Features

- **Rate Limiting**: Configurable request limits per IP
- **CORS Protection**: Cross-origin request validation
- **Security Headers**: Helmet.js integration
- **Input Validation**: Request parameter sanitization
- **Worker Isolation**: Attack processes run in isolated threads

## Usage ⚙️

Once the server is up and running, you can interact with it via the frontend:

1. **Start Attack**:
   - Set up the attack parameters: target URL, attack method (HTTP Flood, Slowloris, TCP, etc...), packet size, duration, and delay.
   - Press "Start Attack" to initiate the stress test.

2. **Stop Attack**:
   - Press "Stop Attack" to terminate the ongoing attack.

### Example Request

```json
{
  "target": "http://example.com",
  "attackMethod": "http_flood",
  "packetSize": 512,
  "duration": 60,
  "packetDelay": 500
}
```

## Adding Proxies and User-Agents

Access to the `data/proxies.txt` and `data/uas.txt` can now be done fully in the frontend. Click the text button to the right of the beam button to open up the editor.

![AnnotatedImage](docs/annotated-button.png)

## Worker-Based Attack Handling 🔧💡

Each attack type is handled in a separate worker thread, ensuring that the main server remains responsive. The attack workers are dynamically loaded based on the selected attack method (HTTP, etc...).

## 🚀 Performance Optimizations

- **Multi-stage Docker builds** for smaller production images
- **Gzip compression** for static assets
- **Browser caching** with appropriate cache headers
- **Worker thread isolation** for attack processing
- **Connection pooling** and keep-alive optimization

## To-Do 📝

- Add more attack methods:
  - UDP 🌐
  - DNS 📡
  - And more! 🔥

- Enhance attack statistics and reporting for better real-time monitoring. 📊

- Add authentication and user management system
- Implement attack scheduling and automation
- Add more visualization options and charts

## Contributing 💖

Feel free to fork the repo and open pull requests with new attack protocols, bug fixes, or improvements. If you have an idea for a new feature, please share it! 😄

### Adding New Attack Methods ⚡

To extend the server with new attack methods (e.g., Minecraft, TCP, UDP, DNS), you can create new worker files and add them to the server configuration.

For example:

- Add a new attack method in the frontend settings.
- Create the corresponding worker file (e.g., `minecraftAttack.js`).
- Update the attack handler configuration to include the new method.

```javascript
const attackHandlers = {
  http_flood: "./workers/httpFloodAttack.js",
  http_slowloris: "./workers/httpSlowlorisAttack.js",
  tcp_flood: "./workers/tcpFloodAttack.js",
  minecraft_ping: "./workers/minecraftPingAttack.js",

  // Add more protocols as needed!
  your_protocol: "./workers/yourProtocolAttack.js"
};
```

---

### FAQs ❓

**1. What operating system does MMB support?**

> **Windows**, **Linux**, **Mac** and **Android (untested)**

**2. It crashes on startup, giving a "concurrently" error**

> Try running two terminals instead of one, in the first one use "npm run dev:client", and in the other one "npm run dev:server". (This happened to several people with Windows 11)

**3. I go to "http://localhost:3000" and nothing appears.**

> Port `3000` is the server port, to see the UI you must use port `5173` (http://localhost:5173)

**4. Requests fail to be sent to the target server (Read timeout and variations)**

> You must put the corresponding proxies in the file `data/proxies.txt`. On each line, put a different proxy that will be used to perform the attack. The format must be the following:
>
> - `protocol://user:password@host:port` (Proxy with authentication)
> - `protocol://host:port`
> - `host:port` (Uses http as default protocol)
> - `host` (Uses 8080 as default port)

**5. How do I enable HTTPS in production?**

> The Docker setup includes Nginx with SSL support. Place your SSL certificates in the `ssl/` directory and update the `nginx.conf` file with your domain.

---

## License 📝

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Disclaimer 🚨

Please note that this project is for educational purposes only and should not be used for malicious purposes.

---

### (｡♥‿♥｡) Happy Hacking 💖🎶
