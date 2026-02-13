package netutil

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"h12.io/socks"

	core "github.com/sammwyy/mikumikubeam/internal/engine"
)

// DialedHTTPClient creates an http.Client configured for the given proxy.
// Supports http/https proxies via CONNECT and socks4/socks5 via h12.io/socks.
func DialedHTTPClient(p core.Proxy, timeout time.Duration, maxRedirects int) *http.Client {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	switch p.Protocol {
	case "http", "https":
		proxyURL := &url.URL{Scheme: p.Protocol, Host: net.JoinHostPort(p.Host, strconv.Itoa(p.Port))}
		if p.Username != "" {
			proxyURL.User = url.UserPassword(p.Username, p.Password)
		}
		transport.Proxy = http.ProxyURL(proxyURL)
		// Ensure CONNECT carries Proxy-Authorization when needed
		if p.Username != "" {
			token := base64.StdEncoding.EncodeToString([]byte(p.Username + ":" + p.Password))
			if transport.ProxyConnectHeader == nil {
				transport.ProxyConnectHeader = make(http.Header)
			}
			transport.ProxyConnectHeader.Set("Proxy-Authorization", "Basic "+token)
		}
	case "socks4", "socks5":
		proxyAddr := p.Protocol + "://" + net.JoinHostPort(p.Host, strconv.Itoa(p.Port))
		dialSocks := socks.Dial(proxyAddr)
		transport.Dial = dialSocks
		// Provide DialContext as well for modern net/http
		transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
			return dialSocks(network, address)
		}
	default:
		// no proxy
	}

	client := &http.Client{Transport: transport, Timeout: timeout}
	if maxRedirects >= 0 {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return http.ErrUseLastResponse
			}
			return nil
		}
	}
	return client
}

// DialedMimicHTTPClient returns an http.Client identical to DialedHTTPClient; use SetMimicHeaders
// to apply browser-like headers on requests.
func DialedMimicHTTPClient(p core.Proxy, timeout time.Duration, maxRedirects int) *http.Client {
	return DialedHTTPClient(p, timeout, maxRedirects)
}

// SetMimicHeaders applies common browser-like headers to the request; UA can be empty.
func SetMimicHeaders(req *http.Request, ua string) {
	if ua != "" {
		req.Header.Set("User-Agent", ua)
	}
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Accept-Encoding", "gzip, deflate, br")
	req.Header.Set("Connection", "keep-alive")
}
