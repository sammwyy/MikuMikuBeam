package engine

import (
	"fmt"
	"time"
)

// SendAttackLog sends a standardized attack log message to the log channel
func SendAttackLog(logCh chan<- AttackStats, proxy Proxy, target string) {
	sourceIP := "<local>"
	if proxy.Host != "" {
		sourceIP = fmt.Sprintf("%s:%d", proxy.Host, proxy.Port)
	}

	// Use non-blocking send to avoid panic on closed channel
	select {
	case logCh <- AttackStats{
		Timestamp: time.Now(),
		Log:       fmt.Sprintf("Miku miku beam from %s to %s", sourceIP, target),
	}:
		// Successfully sent
	default:
		// Channel is closed or full, ignore
	}
}

// SendAttackLogIfVerbose sends a log only if verbose is true
func SendAttackLogIfVerbose(logCh chan<- AttackStats, proxy Proxy, target string, verbose bool) {
	if verbose {
		SendAttackLog(logCh, proxy, target)
	}
}
