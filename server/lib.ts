export type ProxyProtocol = "http" | "https" | "socks4" | "socks5" | string;

export interface Proxy {
  username?: string;
  password?: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
}


