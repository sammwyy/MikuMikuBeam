package main

import (
	"context"
	"encoding/base64"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	socketio "github.com/zishang520/socket.io/socket"

	mc "github.com/sammwyy/mikumikubeam/internal/attacks/game"
	httpA "github.com/sammwyy/mikumikubeam/internal/attacks/http"
	tcpA "github.com/sammwyy/mikumikubeam/internal/attacks/tcp"
	"github.com/sammwyy/mikumikubeam/internal/config"
	"github.com/sammwyy/mikumikubeam/internal/engine"
	"github.com/sammwyy/mikumikubeam/internal/proxy"
	"github.com/sammwyy/mikumikubeam/pkg/api"
	targetpkg "github.com/sammwyy/mikumikubeam/pkg/target"
)

func main() {
	// logging: default to console (human) unless LOG_FORMAT=json
	if strings.ToLower(os.Getenv("LOG_FORMAT")) != "json" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
	}

	// flags
	var noProxyFlag bool
	flag.BoolVar(&noProxyFlag, "no-proxy", false, "Allow running without proxies")
	flag.Parse()

	cfg, _ := config.Load("")
	e := echo.New()
	e.HideBanner = true
	e.Logger.SetOutput(io.Discard)
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{cfg.AllowedOrigin},
		AllowMethods: []string{http.MethodGet, http.MethodPost},
		AllowHeaders: []string{"Content-Type"},
	}))

	// Socket.io server (compatible con v3/v4 clients)
	io := socketio.NewServer(nil, nil)

	reg := engine.NewRegistry()
	reg.Register(engine.AttackHTTPFlood, httpA.NewFloodWorker())
	reg.Register(engine.AttackHTTPBypass, httpA.NewBypassWorker())
	reg.Register(engine.AttackHTTPSlowloris, httpA.NewSlowlorisWorker())
	reg.Register(engine.AttackTCPFlood, tcpA.NewFloodWorker())
	reg.Register(engine.AttackMinecraftPing, mc.NewPingWorker())

	eng := engine.NewEngine(*reg)

	proxies, _ := proxy.LoadProxies(cfg.ProxiesFile)
	uas, _ := proxy.LoadUserAgents(cfg.UserAgentsFile)

	// list attacks endpoint
	e.GET("/attacks", func(c echo.Context) error {
		kinds := reg.ListKinds()
		out := make([]string, 0, len(kinds))
		for _, k := range kinds {
			out = append(out, string(k))
		}
		return c.JSON(http.StatusOK, map[string]any{"attacks": out})
	})

	io.On("connection", func(clients ...any) {
		client := clients[0].(*socketio.Socket)

			client.Emit("stats", map[string]any{
			"pps":          0,
			"proxies":      len(proxies),
			"totalPackets": 0,
			"log":          `{"key":"log_connected"}`,
		})
		log.Info().Msgf("socket connected id=%s", client.Id())

		allowNoProxy := strings.EqualFold(os.Getenv("ALLOW_NO_PROXY"), "true") || noProxyFlag
		clientID := client.Id()
		attackID := fmt.Sprintf("client-%s", clientID)

		client.On("startAttack", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload, ok := datas[0].(map[string]any)
			if !ok {
				return
			}

			log.Debug().Msgf("startAttack event triggered with payload: %+v", payload)

			toInt := func(v any) int {
				switch t := v.(type) {
				case float64:
					return int(t)
				case int:
					return t
				case string:
					if n, err := strconv.Atoi(t); err == nil {
						return n
					}
				}
				return 0
			}

			req := api.StartAttackRequest{
				Target:       fmt.Sprint(payload["target"]),
				AttackMethod: strings.ToLower(fmt.Sprint(payload["attackMethod"])),
				PacketSize:   toInt(payload["packetSize"]),
				DurationSec:  toInt(payload["duration"]),
				PacketDelay:  toInt(payload["packetDelay"]),
				Threads:      toInt(payload["threads"]),
			}

			log.Info().Msgf("startAttack received: method=%s target=%s duration=%ds delay=%d size=%d threads=%d",
				req.AttackMethod, req.Target, req.DurationSec, req.PacketDelay, req.PacketSize, req.Threads)

			kind := engine.AttackKind(req.AttackMethod)
			filtered := proxy.FilterByMethod(proxies, kind)
			client.Emit("stats", map[string]any{"log": `{"key":"log_using_proxies"}`, "proxies": len(filtered)})

			if len(filtered) == 0 && !allowNoProxy {
				msg := `{"key":"error_no_proxies"}`
				log.Warn().Msg(msg)
				client.Emit("attackError", map[string]any{"message": msg})
				return
			}

			tn, _ := targetpkg.Parse(req.Target)
			params := engine.AttackParams{
				Target:      req.Target,
				TargetNode:  tn,
				Duration:    time.Duration(req.DurationSec) * time.Second,
				PacketDelay: time.Duration(req.PacketDelay) * time.Millisecond,
				PacketSize:  req.PacketSize,
				Method:      kind,
				Threads:     req.Threads,
				Verbose:     true, // Always verbose for web client
			}

			statsCh, _ := eng.Start(attackID, context.Background(), params, filtered, uas)
			log.Info().Msgf("attack started: id=%s method=%s target=%s proxies=%d", attackID, req.AttackMethod, req.Target, len(filtered))
			client.Emit("attackAccepted", map[string]any{"ok": true, "proxies": len(filtered)})

			go func() {
				for st := range statsCh {
					payload := map[string]any{
						"pps":          st.PacketsPerS,
						"proxies":      st.Proxies,
						"totalPackets": st.TotalPackets,
					}
					// Only include log if it's not empty
					if st.Log != "" {
						payload["log"] = st.Log
					}
					client.Emit("stats", payload)
				}
			}()
		})

		client.On("stopAttack", func(...any) {
			eng.Stop(attackID)
			client.Emit("attackEnd")
		})

		client.On("disconnect", func(...any) {
			eng.Stop(attackID)
		})
	})

	// Montar Socket.IO en Echo
	e.Any("/socket.io/*", echo.WrapHandler(io.ServeHandler(nil)))

	// Configuration endpoints
	e.GET("/configuration", func(c echo.Context) error {
		pb, _ := osReadFileSafe(cfg.ProxiesFile)
		ub, _ := osReadFileSafe(cfg.UserAgentsFile)
		return c.JSON(http.StatusOK, api.ConfigurationResponse{
			Proxies: base64.StdEncoding.EncodeToString(pb),
			UAs:     base64.StdEncoding.EncodeToString(ub),
		})
	})

	e.POST("/configuration", func(c echo.Context) error {
		type body struct {
			Proxies string `json:"proxies"`
			UAs     string `json:"uas"`
		}
		var b body
		if err := c.Bind(&b); err != nil {
			return err
		}
		if b.Proxies != "" {
			if data, err := base64.StdEncoding.DecodeString(b.Proxies); err == nil {
				_ = osWriteFileSafe(cfg.ProxiesFile, data)
			}
		}
		if b.UAs != "" {
			if data, err := base64.StdEncoding.DecodeString(b.UAs); err == nil {
				_ = osWriteFileSafe(cfg.UserAgentsFile, data)
			}
		}
		return c.String(http.StatusOK, "OK")
	})

	// Determine static directory
	staticDirs := []string{
		filepath.Join("bin", "web-client"),
		filepath.Join("web-client", "dist"),
	}
	var staticDir string
	for _, dir := range staticDirs {
		if fi, err := os.Stat(dir); err == nil && fi.IsDir() {
			staticDir = dir
			break
		}
	}

	// Custom locales handler (Cascading: data/locales -> internal)
	e.GET("/locales/:file", func(c echo.Context) error {
		file := c.Param("file")
		// Basic directory traversal protection
		if strings.Contains(file, "..") || strings.Contains(file, "/") || strings.Contains(file, "\\") {
			return c.NoContent(http.StatusBadRequest)
		}

		// 1. Try user-mounted "data/locales"
		userPath := filepath.Join("data", "locales", file)
		if _, err := os.Stat(userPath); err == nil {
			return c.File(userPath)
		}

		// 2. Try default built-in assets
		if staticDir != "" {
			defaultPath := filepath.Join(staticDir, "locales", file)
			if _, err := os.Stat(defaultPath); err == nil {
				return c.File(defaultPath)
			}
		}

		return c.NoContent(http.StatusNotFound)
	})

	// Static file serving
	if staticDir != "" {
		e.Static("/", staticDir)
		indexPath := filepath.Join(staticDir, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			e.File("/", indexPath)
		}
		log.Info().Msgf("Serving static files from %s", staticDir)
	} else {
		log.Warn().Msg("Static web assets not found (bin/web-client or web-client/dist). Panel will be unavailable.")
	}

	log.Info().Msgf("Server listening on :%d", cfg.ServerPort)
	if err := e.Start(":" + intToString(cfg.ServerPort)); err != nil {
		log.Fatal().Err(err).Msg("server error")
	}
}

func osReadFileSafe(p string) ([]byte, error) {
	b, err := os.ReadFile(p)
	if err != nil {
		return []byte(""), nil
	}
	return b, nil
}

func osWriteFileSafe(p string, b []byte) error {
	return os.WriteFile(p, b, 0o644)
}

func intToString(i int) string { return fmt.Sprintf("%d", i) }
