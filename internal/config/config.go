package config

import (
	"os"
	"path/filepath"

	"github.com/creasty/defaults"
	"github.com/pelletier/go-toml/v2"
)

type Config struct {
	ProxiesFile    string `toml:"proxies_file" default:"data/proxies.txt"`
	UserAgentsFile string `toml:"user_agents_file" default:"data/uas.txt"`
	ServerPort     int    `toml:"server_port" default:"3000"`
	AllowedOrigin  string `toml:"allowed_origin" default:"http://localhost:5173"`
}

func Default() Config {
	var c Config
	_ = defaults.Set(&c)
	return c
}

func Load(path string) (Config, error) {
	if path == "" {
		return Default(), nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return Default(), nil
	}
	c := Default()
	if err := toml.Unmarshal(b, &c); err != nil {
		return Default(), nil
	}
	return c, nil
}

func ResolvePath(baseDir, p string) string {
	if filepath.IsAbs(p) {
		return p
	}
	if baseDir == "" {
		wd, _ := os.Getwd()
		baseDir = wd
	}
	return filepath.Join(baseDir, p)
}
