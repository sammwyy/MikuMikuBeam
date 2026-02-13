package proxy

import (
	"bufio"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/sammwyy/mikumikubeam/internal/engine"
)

var reAuth = regexp.MustCompile(`^([^:]+):([^@]+)@(.+)$`)

func LoadProxies(path string) ([]engine.Proxy, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var out []engine.Proxy
	s := bufio.NewScanner(f)
	for s.Scan() {
		line := strings.TrimSpace(s.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		proto := "http"
		rest := line
		if strings.Contains(line, "://") {
			parts := strings.SplitN(line, "://", 2)
			proto = parts[0]
			rest = parts[1]
		}
		user := ""
		pass := ""
		if m := reAuth.FindStringSubmatch(rest); len(m) == 4 {
			user, pass, rest = m[1], m[2], m[3]
		}
		host := rest
		port := 8080
		if strings.Contains(rest, ":") {
			hp := strings.SplitN(rest, ":", 2)
			host = hp[0]
			if p, err := strconv.Atoi(hp[1]); err == nil {
				port = p
			}
		}
		out = append(out, engine.Proxy{Username: user, Password: pass, Protocol: proto, Host: host, Port: port})
	}
	return out, s.Err()
}

func LoadUserAgents(path string) ([]string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(b), "\n")
	uas := make([]string, 0, len(lines))
	for _, ln := range lines {
		ln = strings.TrimSpace(ln)
		if ln == "" || strings.HasPrefix(ln, "#") {
			continue
		}
		uas = append(uas, ln)
	}
	return uas, nil
}

// Filter proxies by method. For now, mimic original behavior.
func FilterByMethod(proxies []engine.Proxy, method engine.AttackKind) []engine.Proxy {
	allowed := map[engine.AttackKind]map[string]bool{
		engine.AttackHTTPFlood:     {"http": true, "https": true, "socks4": true, "socks5": true},
		engine.AttackHTTPBypass:    {"http": true, "https": true, "socks4": true, "socks5": true},
		engine.AttackHTTPSlowloris: {"socks4": true, "socks5": true},
		engine.AttackTCPFlood:      {"socks4": true, "socks5": true},
		engine.AttackMinecraftPing: {"socks4": true, "socks5": true},
	}
	allowedSet := allowed[method]
	out := make([]engine.Proxy, 0, len(proxies))
	for _, p := range proxies {
		if allowedSet[p.Protocol] {
			out = append(out, p)
		}
	}
	return out
}
