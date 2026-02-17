import { Bot, ScrollText, Wand2, Wifi, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { mmbClient } from "./lib/mmb-client";

interface LogEntry {
  key?: string;
  params?: Record<string, any>;
  text?: string;
}

function isHostLocal(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("::1") ||
    host.startsWith("192.168") ||
    host.startsWith("10.") ||
    host.startsWith("172.")
  );
}

function ConfigureProxiesAndAgentsView() {
  const { t } = useTranslation();
  const [loadingConfiguration, setLoadingConfiguration] = useState(false);
  const [configuration, setConfiguration] = useState<string[]>([]);

  async function retrieveConfiguration(): Promise<string[]> {
    const cfg = await mmbClient.getConfiguration();
    return [cfg.proxies, cfg.uas];
  }

  useEffect(() => {
    if (!loadingConfiguration) {
      setLoadingConfiguration(true);
      retrieveConfiguration().then((config) => {
        setLoadingConfiguration(false);
        setConfiguration(config);
      });
    }
  }, []);

  function saveConfiguration() {
    mmbClient.setConfiguration(configuration[0], configuration[1]).then(() => {
      alert(t("saved"));
      window.location.reload();
    });
  }

  return (
    <div className="fixed grid p-8 mx-auto -translate-x-1/2 -translate-y-1/2 bg-white rounded-md shadow-lg max-w-7xl place-items-center left-1/2 top-1/2">
      {loadingConfiguration ? (
        <div className="flex flex-col items-center justify-center space-y-2">
          <img src="/loading.gif" className="rounded-sm shadow-sm" />
          <p>{t("loading_config")}</p>
        </div>
      ) : (
        <div className="w-[56rem] flex flex-col">
          <p className="pl-1 mb-1 italic">{t("proxies_label")}</p>
          <textarea
            value={configuration[0]}
            className="w-full h-40 p-2 border-black/10 border-[1px] rounded-sm resize-none"
            onChange={(e) =>
              setConfiguration([e.target.value, configuration[1]])
            }
            placeholder="socks5://0.0.0.0&#10;socks4://user:pass@0.0.0.0:12345"
          ></textarea>
          <p className="pl-1 mt-2 mb-1 italic">{t("uas_label")}</p>
          <textarea
            value={configuration[1]}
            className="w-full h-40 p-2 border-black/10 border-[1px] rounded-sm resize-none"
            onChange={(e) =>
              setConfiguration([configuration[0], e.target.value])
            }
            placeholder="Mozilla/5.0 (Linux; Android 10; K)..."
          ></textarea>
          <button
            onClick={saveConfiguration}
            className="p-4 mt-4 text-white bg-gray-800 rounded-md hover:bg-gray-900"
          >
            {t("write_changes")}
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.title = t("title");
  }, [i18n.language, t]);
  const [isAttacking, setIsAttacking] = useState(false);
  const [actuallyAttacking, setActuallyAttacking] = useState(false);
  const [animState, setAnimState] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState("");
  const [attackMethod, setAttackMethod] = useState("http_flood");
  const [packetSize, setPacketSize] = useState(64);
  const [duration, setDuration] = useState(60);
  const [packetDelay, setPacketDelay] = useState(100);
  const [stats, setStats] = useState({ pps: 0, bots: 0, totalPackets: 0 });
  const [lastUpdatedPPS, setLastUpdatedPPS] = useState(Date.now());
  const [lastTotalPackets, setLastTotalPackets] = useState(0);
  const [currentTask, setCurrentTask] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [audioVol, setAudioVol] = useState(100);
  const [openedConfig, setOpenedConfig] = useState(false);
  const [socketState, setSocketState] = useState<
    "disconnected" | "connecting" | "connected"
  >("connecting");
  const [lastSocketError, setLastSocketError] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const handler = () => {
        if (audio.paused) return;

        if (
          animState !== 2 &&
          audio.currentTime > 5.24 &&
          audio.currentTime < 9.4
        ) {
          setAnimState(2);
        }
        if (audio.currentTime > 17.53) {
          audio.currentTime = 15.86;
        }
      };

      audio.addEventListener("timeupdate", handler);
      return () => {
        audio.removeEventListener("timeupdate", handler);
      };
    }
  }, [audioRef]);

  useEffect(() => {
    if (!isAttacking) {
      setActuallyAttacking(false);
      setAnimState(0);

      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      if (currentTask) {
        clearTimeout(currentTask);
      }
    }
  }, [isAttacking, currentTask]);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdatedPPS >= 500) {
      setLastUpdatedPPS(now);
      setStats((old) => ({
        pps: (old.totalPackets - lastTotalPackets) / (now - lastUpdatedPPS),
        bots: old.bots,
        totalPackets: old.totalPackets,
      }));
      setLastTotalPackets(stats.totalPackets);
    }
  }, [lastUpdatedPPS, lastTotalPackets, stats.totalPackets]);

  const addLog = (message: string) => {
    let entry: LogEntry = { text: message };
    try {
      if (message.startsWith("{")) {
        const parsed = JSON.parse(message);
        if (parsed.key) {
          entry = { key: parsed.key, params: parsed.params || {} };
        }
      }
    } catch (e) {
      // Not a JSON message, use as is
    }
    setLogs((prev) => [entry, ...prev].slice(0, 12));
  };

  useEffect(() => {
    // socket state handlers
    if (mmbClient.socket.connected) {
      setSocketState("connected");
      // If already connected, we likely missed the initial log event
      addLog('{"key":"log_connected"}');
    } else {
      setSocketState("connecting");
    }

    mmbClient.onConnect(() => {
      setSocketState("connected");
      setLastSocketError("");
    });
    mmbClient.onConnectError((e) => {
      setSocketState("disconnected");
      setLastSocketError(String(e?.message || e));
    });
    mmbClient.onDisconnect((r) => {
      setSocketState("disconnected");
      setLastSocketError(String(r || ""));
    });

    mmbClient.onStats((data) => {
      setStats((old) => ({
        pps: data.pps || old.pps,
        bots: (data as any).bots || (data as any).proxies || old.bots,
        totalPackets: data.totalPackets || old.totalPackets,
      }));
      if (data.log) addLog(data.log);
      setProgress((prev) => (prev + 10) % 100);
    });

    mmbClient.onAttackEnd(() => {
      setIsAttacking(false);
    });

    mmbClient.onAttackAccepted((info) => {
      addLog(t("attack_accepted", { proxies: info?.proxies ?? 0 }));
    });
    mmbClient.onAttackError((info) => {
      addLog(t("attack_error", { message: info?.message || "" }));
      setIsAttacking(false);
    });

    return () => {
      mmbClient.offAll();
    };
  }, [t]); // Changed from [] to [t] to react to language changes? Actually better to re-register if t changes, or just let t dynamic?
  // It's safer to not depend on t in effect if we want to avoid re-subscription loops, but t should be stable-ish.
  // Actually, t function reference changes on language change.
  // Let's keep it simple. The logs already emitted won't translate magically, but new ones will.

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVol / 100;
    }
  }, [audioVol]);

  const startAttack = (isQuick?: boolean) => {
    if (!target.trim()) {
      alert(t("enter_target_alert"));
      return;
    }

    setIsAttacking(true);
    setStats((old) => ({ pps: 0, bots: old.bots, totalPackets: 0 }));
    addLog(t("preparing_attack"));

    // Play audio
    if (audioRef.current) {
      audioRef.current.currentTime = isQuick ? 9.5 : 0;
      audioRef.current.volume = audioVol / 100;
      audioRef.current.play();
    }

    if (!isQuick) setAnimState(1);

    // Start attack after audio intro
    const timeout = setTimeout(
      () => {
        setActuallyAttacking(true);
        setAnimState(3);
        mmbClient.startAttack({
          target,
          packetSize,
          duration,
          packetDelay,
          attackMethod,
        });
      },
      isQuick ? 700 : 10250,
    );
    setCurrentTask(timeout);
  };

  const stopAttack = () => {
    mmbClient.stopAttack();
    setIsAttacking(false);
  };

  return (
    <div
      className={`w-screen h-screen bg-gradient-to-br ${animState === 0 || animState === 3 ? "from-pink-100 to-blue-100" : animState === 2 ? "background-pulse" : "bg-gray-950"} p-8 overflow-y-auto ${actuallyAttacking ? "shake" : ""}`}
    >
      <audio ref={audioRef} src="/audio.mp3" />

      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="mb-2 text-4xl font-bold text-pink-500">
            {t("title")}
          </h1>
          <div className="flex items-center justify-center gap-2 text-sm">
            {socketState === "connected" && (
              <span className="px-2 py-0.5 rounded bg-green-500 text-white">
                {t("connected")}
              </span>
            )}
            {socketState === "connecting" && (
              <span className="px-2 py-0.5 rounded bg-yellow-500 text-white">
                {t("connecting")}
              </span>
            )}
            {socketState === "disconnected" && (
              <span className="px-2 py-0.5 rounded bg-red-500 text-white">
                {t("disconnected_error", { error: lastSocketError })}
              </span>
            )}
          </div>
          <p
            className={`${animState === 0 || animState === 3 ? "text-gray-600" : "text-white"}`}
          >
            {t("subtitle")}
          </p>
        </div>

        <div
          className={`relative p-6 overflow-hidden rounded-lg shadow-xl ${
            animState === 0 || animState === 3 ? "bg-white" : "bg-gray-950"
          }`}
        >
          {/* Miku GIF */}
          <div
            className="flex justify-center w-full h-48 mb-6"
            style={{
              backgroundImage: "url('/miku.gif')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "cover",
              opacity: animState === 0 || animState === 3 ? 1 : 0,
              transition: "opacity 0.2s ease-in-out",
            }}
          ></div>

          {/* Attack Configuration */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={t("target_placeholder")}
                className={`${
                  animState === 0 || animState === 3 ? "" : "text-white"
                } px-4 py-2 border border-pink-200 rounded-lg outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200`}
                disabled={isAttacking}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => (isAttacking ? stopAttack() : startAttack())}
                  className={`
                  px-8 py-2 rounded-lg font-semibold text-white transition-all w-full
                  ${
                    isAttacking
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-pink-500 hover:bg-pink-600"
                  }
                  flex items-center justify-center gap-2
                `}
                >
                  <Wand2 className="w-5 h-5" />
                  {isAttacking ? t("stop_beam") : t("start_beam")}
                </button>
                <button
                  onClick={() =>
                    isAttacking ? stopAttack() : startAttack(true)
                  }
                  className={`
                  px-2 py-2 rounded-lg font-semibold text-white transition-all
                  ${
                    isAttacking
                      ? "bg-gray-500 hover:bg-red-600"
                      : "bg-cyan-500 hover:bg-cyan-600"
                  }
                  flex items-center justify-center gap-2
                `}
                >
                  <Zap className="w-5 h-5" />
                </button>
                <button
                  className={`px-2 py-2 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900`}
                  onClick={() => setOpenedConfig(true)}
                >
                  <ScrollText className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label
                  className={`block mb-1 text-sm font-medium ${
                    animState === 0 || animState === 3
                      ? "text-gray-700"
                      : "text-white"
                  }`}
                >
                  {t("attack_method")}
                </label>
                <select
                  value={attackMethod}
                  onChange={(e) => setAttackMethod(e.target.value)}
                  className={`${
                    animState === 0 || animState === 3 ? "" : "text-gray-900"
                  } w-full px-4 py-2 border border-pink-200 rounded-lg outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200`}
                  disabled={isAttacking}
                >
                  <option value="http_flood">HTTP/Flood</option>
                  <option value="http_bypass">HTTP/Bypass</option>
                  <option value="http_slowloris">HTTP/Slowloris</option>
                  <option value="tcp_flood">TCP/Flood</option>
                  <option value="minecraft_ping">Minecraft/Ping</option>
                </select>
              </div>
              <div>
                <label
                  className={`block mb-1 text-sm font-medium ${
                    animState === 0 || animState === 3
                      ? "text-gray-700"
                      : "text-white"
                  }`}
                >
                  {t("packet_size")}
                </label>
                <input
                  type="number"
                  value={packetSize}
                  onChange={(e) => setPacketSize(Number(e.target.value))}
                  className={`${
                    animState === 0 || animState === 3 ? "" : "text-white"
                  } w-full px-4 py-2 border border-pink-200 rounded-lg outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200`}
                  disabled={isAttacking}
                  min="1"
                  max="1500"
                />
              </div>
              <div>
                <label
                  className={`block mb-1 text-sm font-medium ${
                    animState === 0 || animState === 3
                      ? "text-gray-700"
                      : "text-white"
                  }`}
                >
                  {t("duration")}
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className={`${
                    animState === 0 || animState === 3 ? "" : "text-white"
                  } w-full px-4 py-2 border border-pink-200 rounded-lg outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200`}
                  disabled={isAttacking}
                  min="1"
                  max="300"
                />
              </div>
              <div>
                <label
                  className={`block mb-1 text-sm font-medium ${
                    animState === 0 || animState === 3
                      ? "text-gray-700"
                      : "text-white"
                  }`}
                >
                  {t("packet_delay")}
                </label>
                <input
                  type="number"
                  value={packetDelay}
                  onChange={(e) => setPacketDelay(Number(e.target.value))}
                  className={`${
                    animState === 0 || animState === 3 ? "" : "text-white"
                  } w-full px-4 py-2 border border-pink-200 rounded-lg outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200`}
                  disabled={isAttacking}
                  min="1"
                  max="1000"
                />
              </div>
            </div>
          </div>

          {/* Stats Widgets */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-gradient-to-br from-pink-500/10 to-blue-500/10">
              <div className="flex items-center gap-2 mb-2 text-pink-600">
                <Zap className="w-4 h-4" />
                <span className="font-semibold">{t("pps")}</span>
              </div>
              <div
                className={`text-2xl font-bold ${
                  animState === 0 || animState === 3
                    ? "text-gray-800"
                    : "text-white"
                }`}
              >
                {stats.pps.toLocaleString()}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-pink-500/10 to-blue-500/10">
              <div className="flex items-center gap-2 mb-2 text-pink-600">
                <Bot className="w-4 h-4" />
                <span className="font-semibold">{t("active_bots")}</span>
              </div>
              <div
                className={`text-2xl font-bold ${
                  animState === 0 || animState === 3
                    ? "text-gray-800"
                    : "text-white"
                }`}
              >
                {stats.bots.toLocaleString()}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-pink-500/10 to-blue-500/10">
              <div className="flex items-center gap-2 mb-2 text-pink-600">
                <Wifi className="w-4 h-4" />
                <span className="font-semibold">{t("total_packets")}</span>
              </div>
              <div
                className={`text-2xl font-bold ${
                  animState === 0 || animState === 3
                    ? "text-gray-800"
                    : "text-white"
                }`}
              >
                {stats.totalPackets.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-4 mb-6 overflow-hidden bg-gray-200 rounded-full">
            <div
              className="h-full transition-all duration-500 bg-gradient-to-r from-pink-500 to-blue-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Logs Section */}
          <div className="p-4 font-mono text-sm bg-gray-900 rounded-lg">
            <div className="text-green-400">
              {logs.map((log, index) => (
                <div key={index} className="py-1">
                  {`> ${log.key ? t(log.key, log.params) : log.text}`}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="italic text-gray-500">
                  {">"} {t("waiting_log")}
                </div>
              )}
            </div>
          </div>

          {/* Cute Animation Overlay */}
          {isAttacking && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-blue-500/10 animate-pulse" />
              <div className="absolute top-0 -translate-x-1/2 left-1/2">
                <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" />
              </div>
            </div>
          )}
        </div>

        {openedConfig ? <ConfigureProxiesAndAgentsView /> : undefined}

        <div className="flex flex-col items-center">
          <span className="text-sm text-center text-gray-500">
            🎵 {t("credits")}{" "}
            <a
              href="https://github.com/sammwyy/mikumikubeam"
              target="_blank"
              rel="noreferrer"
            >
              @Sammwy
            </a>{" "}
            🎵
          </span>
          <span className="text-sm text-center text-gray-500">
            {t("translated_by")}{" "}
            <a href={t("translator_url")} target="_blank" rel="noreferrer">
              {t("translator_name")}
            </a>
          </span>
          <div className="flex items-center gap-4 mt-2">
            <span>
              <input
                className="shadow-sm volume_bar focus:border-pink-500"
                type="range"
                min="0"
                max="100"
                step="5"
                draggable="false"
                value={audioVol}
                onChange={(e) => setAudioVol(parseInt(e.target?.value))}
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
