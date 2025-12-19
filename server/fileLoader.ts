import fs from "fs";
import { join } from "path";

import { Proxy } from "./lib";

export const currentPath = () => {
  const path = process.cwd();
  return path === "/" ? "." : path;
};

const loadFileLines = (filePath: string) => {
  try {
    return fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"));
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
};

export function loadUserAgents() {
  return loadFileLines(join(currentPath(), "data/uas.txt"));
}

export function loadProxies(): Proxy[] {
  const lines = loadFileLines(join(currentPath(), "data/proxies.txt"));

  //RegEx for proxies with authentication (protocol://user:pass@host:port)
  const authProxiesRegEx = new RegExp(/^(http|https|socks4|socks5|):\/\/(\S+:\S+)@((\w+|\d+\.\d+\.\d+\.\d+):\d+)$/, 'g');

  return lines.map((line) => {
    const [protocol, loginInfo] = line.split("://");

    if (authProxiesRegEx.test(line)) {
      const [auth, addr] = loginInfo.split("@");
      const [user, pass] = auth.split(":");
      const [host, port] = addr.split(":");

      return { protocol, host, port: parseInt(port), username: user, password: pass };
    } else {
      const [host, port] = loginInfo.split(":");

      return { protocol, host, port: parseInt(port) };
    }
  });
}
