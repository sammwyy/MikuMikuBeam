import { io, Socket } from "socket.io-client";

export type StartAttackPayload = {
    target: string;
    attackMethod: string;
    packetSize: number;
    duration: number; // seconds
    packetDelay: number; // ms
    threads?: number;
};

export type StatsMessage = {
    pps?: number;
    proxies?: number;
    totalPackets?: number;
    log?: string;
};

export class MMBClient {
    socket: Socket;
    constructor() {
        // Enable socket.io client debugging via localStorage: set debug to 'mmb:*'
        // Example: localStorage.setItem('mmb:debug', '1')
        this.socket = io(window.location.origin, {
            transports: ["websocket", "polling"],
        });

        // Basic debug logs
        const dbg = () => typeof window !== 'undefined' && !!localStorage.getItem('mmb:debug');
        this.socket.on('connect', () => { if (dbg()) console.debug('[MMB] socket connected', this.socket.id); });
        this.socket.on('connect_error', (e: any) => { if (dbg()) console.debug('[MMB] socket connect_error', e?.message || e); });
        this.socket.on('disconnect', (reason: string) => { if (dbg()) console.debug('[MMB] socket disconnected', reason); });
    }

    onStats(cb: (s: StatsMessage) => void) {
        this.socket.on("stats", cb);
    }

    onAttackEnd(cb: () => void) {
        this.socket.on("attackEnd", cb);
    }

    onAttackAccepted(cb: (info: any) => void) { this.socket.on('attackAccepted', cb); }
    onAttackError(cb: (info: any) => void) { this.socket.on('attackError', cb); }

    onConnect(cb: () => void) { this.socket.on('connect', cb); }
    onConnectError(cb: (e: any) => void) { this.socket.on('connect_error', cb); }
    onDisconnect(cb: (reason: any) => void) { this.socket.on('disconnect', cb); }

    offAll() {
        this.socket.off("stats");
        this.socket.off("attackEnd");
    }

    startAttack(p: StartAttackPayload) {
        const dbg = () => typeof window !== 'undefined' && !!localStorage.getItem('mmb:debug');
        if (dbg()) console.debug('[MMB] emitting startAttack', p);
        this.socket.emit("startAttack", p);
    }

    stopAttack() {
        this.socket.emit("stopAttack");
    }

    async getAttacks(): Promise<string[]> {
        const res = await fetch(`/attacks`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.attacks || [];
    }

    async getConfiguration(): Promise<{ proxies: string; uas: string }> {
        const res = await fetch(`/configuration`);
        const data = await res.json();
        return {
            proxies: atob(data.proxies || ""),
            uas: atob(data.uas || ""),
        };
    }

    async setConfiguration(proxies: string, uas: string): Promise<void> {
        await fetch(`/configuration`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ proxies: btoa(proxies), uas: btoa(uas) }),
        });
    }
}

export const mmbClient = new MMBClient();


