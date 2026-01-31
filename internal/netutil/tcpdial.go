package netutil

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"h12.io/socks"

	core "github.com/sammwyy/mikumikubeam/internal/engine"
)

// DialedTCPClient dials a TCP (optionally TLS) connection to host:port using optional proxy.
// scheme: "tcp" or "tls" indicates whether to wrap with TLS.
func DialedTCPClient(ctx context.Context, scheme string, host string, port int, p *core.Proxy) (net.Conn, error) {
	address := net.JoinHostPort(host, strconv.Itoa(port))
	d := &net.Dialer{Timeout: 5 * time.Second}

	var baseDial func(ctx context.Context, network, address string) (net.Conn, error)

	if p != nil && p.Host != "" {
		switch p.Protocol {
		case "http", "https":
			// HTTP CONNECT tunneling
			baseDial = d.DialContext
			return dialHTTPConnect(ctx, baseDial, p, address, scheme == "tls", host)
		case "socks4", "socks5":
			proxyAddr := p.Protocol + "://" + net.JoinHostPort(p.Host, strconv.Itoa(p.Port))
			baseDial = func(ctx context.Context, network, address string) (net.Conn, error) {
				return socks.Dial(proxyAddr)(network, address)
			}
		default:
			return nil, errors.New("unsupported proxy protocol: " + p.Protocol)
		}
	} else {
		baseDial = d.DialContext
	}

	c, err := baseDial(ctx, "tcp", address)
	if err != nil {
		return nil, err
	}
	if scheme == "tls" {
		tlsConn := tls.Client(c, &tls.Config{ServerName: host, InsecureSkipVerify: true})
		return tlsConn, nil
	}
	return c, nil
}

func dialHTTPConnect(ctx context.Context, base func(context.Context, string, string) (net.Conn, error), p *core.Proxy, targetAddr string, useTLS bool, serverName string) (net.Conn, error) {
	proxyAddr := net.JoinHostPort(p.Host, strconv.Itoa(p.Port))
	conn, err := base(ctx, "tcp", proxyAddr)
	if err != nil {
		return nil, err
	}
	// Issue CONNECT request
	auth := ""
	if p.Username != "" {
		token := base64.StdEncoding.EncodeToString([]byte(p.Username + ":" + p.Password))
		auth = "Proxy-Authorization: Basic " + token + "\r\n"
	}
	req := fmt.Sprintf("CONNECT %s HTTP/1.1\r\nHost: %s\r\nProxy-Connection: Keep-Alive\r\n%s\r\n", targetAddr, targetAddr, auth)
	if _, err := conn.Write([]byte(req)); err != nil {
		conn.Close()
		return nil, err
	}
	// Read minimal response line (ASCII)
	br := bufio.NewReader(conn)
	line, err := br.ReadString('\n')
	if err != nil {
		conn.Close()
		return nil, err
	}
	if !(len(line) >= 12 && strings.HasPrefix(line, "HTTP/1.1 200")) {
		conn.Close()
		return nil, errors.New("proxy connect failed: " + strings.TrimSpace(line))
	}
	// Drain headers
	for {
		l, err := br.ReadString('\n')
		if err != nil {
			break
		}
		if l == "\r\n" {
			break
		}
	}
	// Wrap with TLS if requested
	if useTLS {
		tlsConn := tls.Client(conn, &tls.Config{ServerName: serverName, InsecureSkipVerify: true})
		return tlsConn, nil
	}
	return conn, nil
}
