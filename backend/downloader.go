package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const DefaultBlocklistURL = "https://raw.githubusercontent.com/badmojr/1Hosts/master/Lite/domains.txt"

type BlocklistDownloader struct {
	url      string
	destPath string
}

func NewBlocklistDownloader(url, destDir string) *BlocklistDownloader {
	return &BlocklistDownloader{
		url:      url,
		destPath: filepath.Join(destDir, "1hosts_lite.txt"),
	}
}

func (bd *BlocklistDownloader) Download() (string, error) {
	log.Printf("Downloading blocklist from %s ...", bd.url)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(bd.url)
	if err != nil {
		return "", fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("bad status: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read failed: %w", err)
	}

	lines := strings.Split(string(body), "\n")
	var clean []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		clean = append(clean, line)
	}

	if err := os.WriteFile(bd.destPath, []byte(strings.Join(clean, "\n")), 0644); err != nil {
		return "", fmt.Errorf("write failed: %w", err)
	}

	log.Printf("Downloaded %d domains to %s", len(clean), bd.destPath)
	return bd.destPath, nil
}

func (bd *BlocklistDownloader) CachePath() string {
	if _, err := os.Stat(bd.destPath); err == nil {
		return bd.destPath
	}
	return ""
}
