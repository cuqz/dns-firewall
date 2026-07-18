package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
)

type ClientManager struct {
	mu      sync.RWMutex
	clients map[*WSClient]bool
}

type WSClient struct {
	send   chan []byte
	closed bool
	mu     sync.Mutex
}

func NewClientManager() *ClientManager {
	return &ClientManager{
		clients: make(map[*WSClient]bool),
	}
}

func (cm *ClientManager) Register(client *WSClient) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.clients[client] = true
}

func (cm *ClientManager) Unregister(client *WSClient) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	if _, ok := cm.clients[client]; ok {
		delete(cm.clients, client)
		client.closeSafe()
	}
}

func (c *WSClient) closeSafe() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.closed {
		close(c.send)
		c.closed = true
	}
}

func (cm *ClientManager) Broadcast(msg WSMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	cm.mu.Lock()
	defer cm.mu.Unlock()
	for client := range cm.clients {
		select {
		case client.send <- data:
		default:
			client.closeSafe()
			delete(cm.clients, client)
		}
	}
}

type API struct {
	firewall *Firewall
	db       *Database
	clients  *ClientManager
	server   *DNSServer
	config   *Config
}

type Config struct {
	DNSAddr    string
	Upstream   string
	APIAddr    string
	DBPath     string
	Blocklists []string
}

func NewAPI(firewall *Firewall, db *Database, clients *ClientManager, server *DNSServer, config *Config) *API {
	return &API{
		firewall: firewall,
		db:       db,
		clients:  clients,
		server:   server,
		config:   config,
	}
}

func (a *API) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/stats", a.handleStats)
	mux.HandleFunc("/api/blocklist", a.handleBlocklist)
	mux.HandleFunc("/api/custom-blocks", a.handleCustomBlocks)
	mux.HandleFunc("/api/health", a.handleHealth)
	mux.HandleFunc("/api/config", a.handleConfig)
	mux.HandleFunc("/ws", a.handleWebSocket)
}

func (a *API) handleStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Parse optional date range from query params
	since := r.URL.Query().Get("since")
	until := r.URL.Query().Get("until")
	groupBy := r.URL.Query().Get("group_by")
	if groupBy == "" {
		groupBy = "hour"
	}

	stats := a.db.GetStats(since, until, groupBy)
	total, updated := a.firewall.Stat()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"stats":            stats,
		"blocklist_domains": total,
		"blocklist_updated": updated,
	})
}

func (a *API) handleBlocklist(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	q := r.URL.Query().Get("q")
	if q != "" {
		results := a.firewall.SearchDomains(q, 50)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"query":   q,
			"total":   len(results),
			"results": results,
		})
		return
	}

	http.Error(w, `{"error":"query parameter 'q' required"}`, http.StatusBadRequest)
}

func (a *API) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

func (a *API) handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"dns_addr": a.config.DNSAddr,
		"api_addr": a.config.APIAddr,
	})
}

func (a *API) handleCustomBlocks(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		domains, _ := a.db.LoadCustomBlocks()
		json.NewEncoder(w).Encode(map[string]interface{}{
			"domains": domains,
			"total":   len(domains),
		})

	case "POST":
		var req struct {
			Domain string `json:"domain"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Domain == "" {
			http.Error(w, `{"error":"domain required"}`, http.StatusBadRequest)
			return
		}
		a.firewall.AddCustom(req.Domain)
		a.db.AddCustomBlock(req.Domain)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "domain": req.Domain})

	case "DELETE":
		var req struct {
			Domain string `json:"domain"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Domain == "" {
			http.Error(w, `{"error":"domain required"}`, http.StatusBadRequest)
			return
		}
		a.firewall.RemoveCustom(req.Domain)
		a.db.RemoveCustomBlock(req.Domain)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "domain": req.Domain})

	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func (a *API) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	upgrader := newWebSocketUpgrader()
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &WSClient{send: make(chan []byte, 256)}
	a.clients.Register(client)

	go client.writePump(conn)
	go client.readPump(conn, a.clients)
}


