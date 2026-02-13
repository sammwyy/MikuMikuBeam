package target

import (
	"net"
	"net/url"
	"strconv"
	"strings"
)

type Node struct {
	Raw    string
	Scheme string // "http", "https", or ""
	Host   string
	Port   int
	Path   string
	Query  string
	IsURL  bool
}

// Parse parses a user-provided target into a Node. Accepts:
// - URL with scheme (http/https)
// - host:port
// - host
func Parse(raw string) (Node, error) {
	n := Node{Raw: raw}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		u, err := url.Parse(raw)
		if err != nil {
			return n, err
		}
		n.IsURL = true
		n.Scheme = u.Scheme
		n.Host = u.Hostname()
		n.Path = u.EscapedPath()
		n.Query = u.RawQuery
		if p := u.Port(); p != "" {
			if pi, err := strconv.Atoi(p); err == nil {
				n.Port = pi
			}
		}
		if n.Port == 0 {
			if n.Scheme == "https" {
				n.Port = 443
			} else {
				n.Port = 80
			}
		}
		return n, nil
	}
	if h, p, err := net.SplitHostPort(raw); err == nil {
		n.Host = h
		if pi, err := strconv.Atoi(p); err == nil {
			n.Port = pi
		}
		return n, nil
	}
	// host only
	n.Host = raw
	n.Port = 80
	return n, nil
}

// ToURL returns a URL suitable for L7. If no scheme, defaults to http unless Port==443.
func (n Node) ToURL() *url.URL {
	scheme := n.Scheme
	if scheme == "" {
		if n.Port == 443 {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}
	u := &url.URL{Scheme: scheme}
	u.Host = net.JoinHostPort(n.Host, strconv.Itoa(n.Port))
	u.Path = n.Path
	u.RawQuery = n.Query
	return u
}

func (n Node) Address() string  { return net.JoinHostPort(n.Host, strconv.Itoa(n.Port)) }
func (n Node) Hostname() string { return n.Host }
func (n Node) PortNum() int     { return n.Port }
