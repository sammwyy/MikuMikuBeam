import express from "express";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { createServer } from "http";
import { dirname, join } from "path";
import { Server } from "socket.io";
import { fileURLToPath, pathToFileURL } from "url";
import { Worker } from "worker_threads";

import bodyParser from "body-parser";
import { currentPath, loadProxies, loadUserAgents } from "./fileLoader";
import { normalizeProxy } from "./proxyUtils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __prod = process.env.NODE_ENV === "production";



const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: __prod ? "" : "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  },
});

const proxies = loadProxies();
const userAgents = loadUserAgents();

console.log("Proxies loaded:", proxies.length);
console.log("User agents loaded:", userAgents.length);

// Dynamic worker loading
const attackWorkers: Record<string, string> = {};
const availableAttacks: any[] = [];

const loadWorkers = async () => {
  const workersDir = join(__dirname, "workers");
  if (existsSync(workersDir)) {
    const files = readdirSync(workersDir).filter((file) => file.endsWith(".js"));
    for (const file of files) {
      try {
        const filePath = join(workersDir, file);
        const moduleUrl = pathToFileURL(filePath).href;
        const module = await import(moduleUrl);
        if (module.info) {
          attackWorkers[module.info.id] = filePath;
          availableAttacks.push(module.info);
          console.log(`Loaded worker: ${module.info.name} (${module.info.id})`);
        }
      } catch (err) {
        console.error(`Failed to load worker ${file}:`, err);
      }
    }
  }
};

app.use(express.static(join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.emit("stats", {
    pps: 0,
    bots: proxies.length,
    totalPackets: 0,
    log: { key: "server_connected" },
  });
  
  // Send available attacks to client
  socket.emit("attacks", availableAttacks);

  socket.on("getAttacks", () => {
    socket.emit("attacks", availableAttacks);
  });

  socket.on("startAttack", (params) => {
    const { target, duration, packetDelay, attackMethod, packetSize } = params;
    
    const attackWorkerFile = attackWorkers[attackMethod];
    const attackInfo = availableAttacks.find((a) => a.id === attackMethod);

    if (!attackWorkerFile || !attackInfo) {
      socket.emit("stats", {
        log: { key: "unsupported_attack_type", params: { type: attackMethod } },
      });
      return;
    }

    const filteredProxies = proxies
      .map(normalizeProxy)
      .filter((proxy) => attackInfo.supportedProtocols.includes(proxy.protocol));

    if (filteredProxies.length === 0) {
      socket.emit("stats", {
        log: { key: "no_proxies" },
      });
      return;
    }

    socket.emit("stats", {
      log: { key: "using_proxies", params: { count: filteredProxies.length } },
      bots: filteredProxies.length,
    });

    const worker = new Worker(attackWorkerFile, {
      workerData: {
        target,
        proxies: filteredProxies,
        userAgents,
        duration,
        packetDelay,
        packetSize,
      },
    });

    worker.on("message", (message) => socket.emit("stats", message));

    worker.on("error", (error: any) => {
      console.error(`Worker error: ${error.message}`);
      socket.emit("stats", { log: { key: "worker_error", params: { error: error.message } } });
    });

    worker.on("exit", (code) => {
      console.log(`Worker exited with code ${code}`);
      socket.emit("attackEnd");
    });

    socket["worker"] = worker;
  });

  socket.on("stopAttack", () => {
    const worker = socket["worker"];
    if (worker) {
      worker.terminate();
      socket.emit("attackEnd");
    }
  });

  socket.on("disconnect", () => {
    const worker = socket["worker"];
    if (worker) {
      worker.terminate();
    }
    console.log("Client disconnected");
  });
});

app.get("/methods", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Content-Type", "application/json");
  res.send(availableAttacks);
});

app.get("/configuration", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Content-Type", "application/json");

  const proxiesText = readFileSync(
    join(currentPath(), "data", "proxies.txt"),
    "utf-8"
  );
  const uasText = readFileSync(join(currentPath(), "data", "uas.txt"), "utf-8");

  res.send({
    proxies: btoa(proxiesText),
    uas: btoa(uasText),
  });
});

app.options("/configuration", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.send();
});

app.post("/configuration", bodyParser.json(), (req, res) => {
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Content-Type", "application/text");

  // console.log(req.body)

  // atob and btoa are used to avoid the problems in sending data with // characters, etc.
  const proxies = atob(req.body["proxies"]);
  const uas = atob(req.body["uas"]);
  writeFileSync(join(currentPath(), "data", "proxies.txt"), proxies, {
    encoding: "utf-8",
  });
  writeFileSync(join(currentPath(), "data", "uas.txt"), uas, {
    encoding: "utf-8",
  });

  res.send("OK");
});

const PORT = parseInt(process.env.PORT || "3000");

try {
  await loadWorkers();
  httpServer.listen(PORT, () => {
    if (__prod) {
      console.log(
        `(Production Mode) Client and server is running under http://localhost:${PORT}`
      );
    } else {
      console.log(`Server is running under development port ${PORT}`);
    }
  });
} catch (err) {
  console.error("Failed to load workers:", err);
  process.exit(1);
}
