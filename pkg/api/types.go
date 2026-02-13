package api

import (
	"time"
)

type StartAttackRequest struct {
	Target       string `json:"target"`
	DurationSec  int    `json:"duration"`
	PacketDelay  int    `json:"packetDelay"`
	AttackMethod string `json:"attackMethod"`
	PacketSize   int    `json:"packetSize"`
	Threads      int    `json:"threads,omitempty"`
}

type ConfigurationResponse struct {
	Proxies string `json:"proxies"`
	UAs     string `json:"uas"`
}

type StatsPayload struct {
	Timestamp    time.Time `json:"timestamp"`
	PPS          int64     `json:"pps"`
	TotalPackets int64     `json:"totalPackets"`
	Proxies      int       `json:"proxies"`
	Log          string    `json:"log"`
}
