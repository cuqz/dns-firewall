package main

import "time"

type QueryLog struct {
	ID        int64     `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	ClientIP  string    `json:"client_ip"`
	Domain    string    `json:"domain"`
	QueryType string    `json:"query_type"`
	Blocked   bool      `json:"blocked"`
	Duration  int64     `json:"duration_ms"`
}

type Stats struct {
	TotalQueries       int64          `json:"total_queries"`
	BlockedCount       int64          `json:"blocked_count"`
	BlockedPct         float64        `json:"blocked_pct"`
	TopDomains         []DomainCount  `json:"top_domains"`
	TopBlockedDomains  []DomainCount  `json:"top_blocked_domains"`
	TopClients         []ClientCount  `json:"top_clients"`
	TopBlockedClients  []ClientCount  `json:"top_blocked_clients"`
	QueryTypes         []TypeCount    `json:"query_types"`
	QueriesLast24      []TimeBucket   `json:"queries_last_24h"`
}

type DomainCount struct {
	Domain string `json:"domain"`
	Count  int64  `json:"count"`
}

type ClientCount struct {
	ClientIP string `json:"client_ip"`
	Hostname string `json:"hostname"`
	Count    int64  `json:"count"`
}

type TimeBucket struct {
	Hour        string  `json:"hour"`
	Total       int64   `json:"total"`
	Blocked     int64   `json:"blocked"`
	AvgDuration float64 `json:"avg_duration_ms"`
}

type TypeCount struct {
	Type  string `json:"type"`
	Count int64  `json:"count"`
}

type BlocklistEntry struct {
	Domain string `json:"domain"`
	Active bool   `json:"active"`
}

type WSMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}
