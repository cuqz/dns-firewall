package main

import (
	"database/sql"
	"fmt"
	"log"
	"net"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type Database struct {
	db *sql.DB
}

func NewDatabase(path string) (*Database, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	d := &Database{db: db}
	if err := d.migrate(); err != nil {
		return nil, err
	}

	go d.cleanup()
	return d, nil
}

func (d *Database) migrate() error {
	_, err := d.db.Exec(`
		CREATE TABLE IF NOT EXISTS query_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
			client_ip TEXT NOT NULL,
			domain TEXT NOT NULL,
			query_type TEXT NOT NULL,
			blocked BOOLEAN NOT NULL DEFAULT 0,
			duration_ms INTEGER NOT NULL DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS idx_timestamp ON query_logs(timestamp);
		CREATE INDEX IF NOT EXISTS idx_blocked ON query_logs(blocked);
		CREATE INDEX IF NOT EXISTS idx_domain ON query_logs(domain);
		CREATE INDEX IF NOT EXISTS idx_client_ip ON query_logs(client_ip);

		CREATE TABLE IF NOT EXISTS client_names (
			client_ip TEXT PRIMARY KEY,
			hostname TEXT NOT NULL DEFAULT ''
		);

		CREATE TABLE IF NOT EXISTS custom_blocks (
			domain TEXT PRIMARY KEY,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`)
	return err
}

func (d *Database) LoadCustomBlocks() ([]string, error) {
	rows, err := d.db.Query("SELECT domain FROM custom_blocks ORDER BY domain")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var domains []string
	for rows.Next() {
		var dm string
		rows.Scan(&dm)
		domains = append(domains, dm)
	}
	return domains, nil
}

func (d *Database) AddCustomBlock(domain string) error {
	_, err := d.db.Exec("INSERT OR IGNORE INTO custom_blocks (domain) VALUES (?)", strings.ToLower(domain))
	return err
}

func (d *Database) RemoveCustomBlock(domain string) error {
	_, err := d.db.Exec("DELETE FROM custom_blocks WHERE domain = ?", strings.ToLower(domain))
	return err
}

func (d *Database) resolveHostname(ip string) string {
	var hostname string
	err := d.db.QueryRow("SELECT hostname FROM client_names WHERE client_ip = ?", ip).Scan(&hostname)
	if err == nil && hostname != "" {
		return hostname
	}

	names, err := net.LookupAddr(ip)
	if err == nil && len(names) > 0 {
		hostname = names[0]
		// trailing dot from PTR records
		if len(hostname) > 0 && hostname[len(hostname)-1] == '.' {
			hostname = hostname[:len(hostname)-1]
		}
	}

	if hostname == "" {
		hostname = ip
	}

	d.db.Exec("INSERT OR REPLACE INTO client_names (client_ip, hostname) VALUES (?, ?)", ip, hostname)
	return hostname
}

func (d *Database) LogQuery(clientIP, domain, queryType string, blocked bool, durationMs int64) {
	_, err := d.db.Exec(
		"INSERT INTO query_logs (client_ip, domain, query_type, blocked, duration_ms) VALUES (?, ?, ?, ?, ?)",
		clientIP, domain, queryType, blocked, durationMs,
	)
	if err != nil {
		log.Printf("Failed to log query: %v", err)
	}

	select {
	case hostnameSem <- struct{}{}:
		go func() {
			defer func() { <-hostnameSem }()
			d.resolveHostname(clientIP)
		}()
	default:
		// skip resolution under load
	}
}

func (d *Database) GetStats(since, until, groupBy string) Stats {
	var s Stats

	// Resolve time range: accept ISO timestamps or SQLite relative expressions
	sinceTs, untilTs := resolveTimeRange(since, until)

	d.db.QueryRow("SELECT COUNT(*) FROM query_logs WHERE timestamp >= ? AND timestamp <= ?", sinceTs, untilTs).Scan(&s.TotalQueries)
	d.db.QueryRow("SELECT COUNT(*) FROM query_logs WHERE blocked = 1 AND timestamp >= ? AND timestamp <= ?", sinceTs, untilTs).Scan(&s.BlockedCount)

	if s.TotalQueries > 0 {
		s.BlockedPct = float64(s.BlockedCount) / float64(s.TotalQueries) * 100
	}

	rows, err := d.db.Query(`
		SELECT domain, COUNT(*) as cnt FROM query_logs
		WHERE timestamp >= ? AND timestamp <= ?
		GROUP BY domain ORDER BY cnt DESC LIMIT 10
	`, sinceTs, untilTs)
		if err == nil {
		defer rows.Close()
		for rows.Next() {
			var dc DomainCount
			if err := rows.Scan(&dc.Domain, &dc.Count); err != nil {
				log.Printf("Scan error (top domains): %v", err)
				continue
			}
			s.TopDomains = append(s.TopDomains, dc)
		}
	}

	rows2, err := d.db.Query(`
		SELECT q.client_ip, COALESCE(c.hostname, q.client_ip), COUNT(*) as cnt
		FROM query_logs q
		LEFT JOIN client_names c ON q.client_ip = c.client_ip
		WHERE q.timestamp >= ? AND q.timestamp <= ?
		GROUP BY q.client_ip ORDER BY cnt DESC LIMIT 10
	`, sinceTs, untilTs)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var cc ClientCount
			if err := rows2.Scan(&cc.ClientIP, &cc.Hostname, &cc.Count); err != nil {
				log.Printf("Scan error (top clients): %v", err)
				continue
			}
			s.TopClients = append(s.TopClients, cc)
		}
	}

	var timeFmt string
	switch groupBy {
	case "month":
		timeFmt = "%Y-%m-01T00:00:00Z"
	case "day":
		timeFmt = "%Y-%m-%dT00:00:00Z"
	default:
		timeFmt = "%Y-%m-%dT%H:00:00Z"
	}

	timeQuery := fmt.Sprintf(`SELECT strftime('%s', timestamp) as period,
		COUNT(*) as total,
		SUM(CASE WHEN blocked THEN 1 ELSE 0 END) as blocked
		FROM query_logs
		WHERE timestamp >= ? AND timestamp <= ?
		GROUP BY period ORDER BY period`, timeFmt)

	rows3, err := d.db.Query(timeQuery, sinceTs, untilTs)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var tb TimeBucket
			rows3.Scan(&tb.Hour, &tb.Total, &tb.Blocked)
			s.QueriesLast24 = append(s.QueriesLast24, tb)
		}
	} else {
		log.Printf("Time bucket query error: %v", err)
	}

	rows4, err := d.db.Query(`
		SELECT q.client_ip, COALESCE(c.hostname, q.client_ip), COUNT(*) as cnt
		FROM query_logs q
		LEFT JOIN client_names c ON q.client_ip = c.client_ip
		WHERE q.blocked = 1 AND q.timestamp >= ? AND q.timestamp <= ?
		GROUP BY q.client_ip ORDER BY cnt DESC LIMIT 10
	`, sinceTs, untilTs)
	if err == nil {
		defer rows4.Close()
		for rows4.Next() {
			var cc ClientCount
			rows4.Scan(&cc.ClientIP, &cc.Hostname, &cc.Count)
			s.TopBlockedClients = append(s.TopBlockedClients, cc)
		}
	}

	return s
}

// frontend sends ISO 8601, defaults get filled in
func resolveTimeRange(since, until string) (string, string) {
	if since == "" {
		since = time.Now().UTC().Add(-24 * time.Hour).Format(time.RFC3339)
	}
	if until == "" {
		until = time.Now().UTC().Format(time.RFC3339)
	}
	return since, until
}

func (d *Database) cleanup() {
	ticker := time.NewTicker(1 * time.Hour)
	for range ticker.C {
		d.db.Exec("DELETE FROM query_logs WHERE timestamp < datetime('now', '-30 days')")
		_, err := d.db.Exec("VACUUM")
		if err != nil {
			log.Printf("Vacuum error: %v", err)
		}
	}
}

func (d *Database) Close() {
	d.db.Close()
}
