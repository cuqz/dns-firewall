package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func newWebSocketUpgrader() websocket.Upgrader {
	return upgrader
}

func (c *WSClient) writePump(conn *websocket.Conn) {
	defer conn.Close()
	for msg := range c.send {
		if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return
		}
	}
}

func (c *WSClient) readPump(conn *websocket.Conn, cm *ClientManager) {
	defer func() {
		cm.Unregister(c)
		conn.Close()
	}()
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func main() {
	exeDir := filepath.Dir(os.Args[0])
	dbPath := filepath.Join(exeDir, "dns-firewall.db")
	blocklistPath := filepath.Join(exeDir, "blocklists")
	frontendDir := filepath.Join(exeDir, "..", "frontend", "dist")

	config := &Config{
		DNSAddr:  ":53",
		Upstream: "1.1.1.1:53",
		APIAddr:  ":8080",
		DBPath:   dbPath,
	}

	if env := os.Getenv("DNS_ADDR"); env != "" {
		config.DNSAddr = env
	}
	if env := os.Getenv("UPSTREAM"); env != "" {
		config.Upstream = env
	}
	if env := os.Getenv("API_ADDR"); env != "" {
		config.APIAddr = env
	}
	if env := os.Getenv("FRONTEND_DIR"); env != "" {
		frontendDir = env
	}

	for i := 0; i < len(os.Args); i++ {
		switch os.Args[i] {
		case "--dns-addr":
			if i+1 < len(os.Args) {
				config.DNSAddr = os.Args[i+1]
				i++
			}
		case "--upstream":
			if i+1 < len(os.Args) {
				config.Upstream = os.Args[i+1]
				i++
			}
		case "--api-addr":
			if i+1 < len(os.Args) {
				config.APIAddr = os.Args[i+1]
				i++
			}
		case "--db-path":
			if i+1 < len(os.Args) {
				config.DBPath = os.Args[i+1]
				i++
			}
		case "--frontend-dir":
			if i+1 < len(os.Args) {
				frontendDir = os.Args[i+1]
				i++
			}
		}
	}

	log.Printf("DNS Firewall starting...")
	log.Printf("  DNS:     %s (upstream: %s)", config.DNSAddr, config.Upstream)
	log.Printf("  API:     %s", config.APIAddr)
	log.Printf("  DB:      %s", config.DBPath)
	log.Printf("  Frontend: %s", frontendDir)

	db, err := NewDatabase(config.DBPath)
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}
	defer db.Close()

	firewall := NewFirewall()

	dl := NewBlocklistDownloader(DefaultBlocklistURL, exeDir)

	blocklistFile := dl.CachePath()
	if blocklistFile == "" {
		log.Println("No cached blocklist found, downloading 1Hosts Lite...")
		var err error
		blocklistFile, err = dl.Download()
		if err != nil {
			log.Printf("Warning: could not download blocklist: %v (falling back to built-in)", err)
			blocklistFile = filepath.Join(blocklistPath, "default.txt")
		}
	} else {
		log.Printf("Using cached blocklist: %s", blocklistFile)
	}

	if _, err := os.Stat(blocklistFile); err == nil {
		if err := firewall.LoadBlocklist(blocklistFile); err != nil {
			log.Printf("Warning: could not load blocklist: %v", err)
		}
	}

	clients := NewClientManager()

	dnsServer := NewDNSServer(config.Upstream, firewall, db, clients)

	api := NewAPI(firewall, db, clients, dnsServer, config)

	mux := http.NewServeMux()
	api.RegisterRoutes(mux)

	fs := http.FileServer(http.Dir(frontendDir))
	mux.Handle("/", fs)

	go func() {
		log.Printf("API server listening on %s", config.APIAddr)
		if err := http.ListenAndServe(config.APIAddr, mux); err != nil {
			log.Fatalf("API server error: %v", err)
		}
	}()

	dnsServer.Start(config.DNSAddr)
}
