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
	send chan []byte
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
		close(client.send)
	}
}

func (cm *ClientManager) Broadcast(msg WSMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	cm.mu.RLock()
	defer cm.mu.RUnlock()
	for client := range cm.clients {
		select {
		case client.send <- data:
		default:
			close(client.send)
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
	mux.HandleFunc("/api/health", a.handleHealth)
	mux.HandleFunc("/api/config", a.handleConfig)
	mux.HandleFunc("/ws", a.handleWebSocket)
}

func (a *API) handleStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	stats := a.db.GetStats()
	total, updated := a.firewall.Stat()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"stats":            stats,
		"blocklist_domains": total,
		"blocklist_updated": updated,
	})
}

func (a *API) handleBlocklist(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	domains := a.firewall.Domains()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total":   len(domains),
		"domains": domains,
	})
}

func (a *API) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

func (a *API) handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(a.config)
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


