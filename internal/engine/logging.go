package engine

import (
	"fmt"
	"time"
)

// SendAttackLog sends a standardized attack log message to the log channel.
// Uses recover() to safely handle sends to closed channels.
func SendAttackLog(logCh chan<- AttackStats, proxy Proxy, target string) {
	sourceIP := "<local>"
	if proxy.Host != "" {
		sourceIP = fmt.Sprintf("%s:%d", proxy.Host, proxy.Port)
	}

	safeSend(logCh, AttackStats{
		Timestamp: time.Now(),
		Log:       fmt.Sprintf("Miku miku beam from %s to %s", sourceIP, target),
	})
}

// SendAttackLogIfVerbose sends a log only if verbose is true.
func SendAttackLogIfVerbose(logCh chan<- AttackStats, proxy Proxy, target string, verbose bool) {
	if verbose {
		SendAttackLog(logCh, proxy, target)
	}
}

// safeSend mengirim ke channel tanpa panic meski channel sudah ditutup.
func safeSend(logCh chan<- AttackStats, stat AttackStats) {
	defer func() {
		recover() // tangkap panic "send on closed channel"
	}()
	select {
	case logCh <- stat:
	default:
		// channel penuh, abaikan
	}
}