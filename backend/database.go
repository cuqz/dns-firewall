package main

import (
	"database/sql"
	"fmt"
	"log"
	"net"
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
	`)
	return err
}

func (d *Database) resolveHostname(ip string) string {
	// Check cache first
	var hostname string
	err := d.db.QueryRow("SELECT hostname FROM client_names WHERE client_ip = ?", ip).Scan(&hostname)
	if err == nil && hostname != "" {
		return hostname
	}

	// Try reverse DNS lookup
	names, err := net.LookupAddr(ip)
	if err == nil && len(names) > 0 {
		hostname = names[0]
		// Strip trailing dot
		if len(hostname) > 0 && hostname[len(hostname)-1] == '.' {
			hostname = hostname[:len(hostname)-1]
		}
	}

	if hostname == "" {
		hostname = ip
	}

	// Cache it
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

	// Async hostname resolution
	go d.resolveHostname(clientIP)
}

func (d *Database) GetStats(since, until, groupBy string) Stats {
	var s Stats

	// Resolve time range: accept ISO timestamps or SQLite relative expressions
	sinceTs, untilTs := resolveTimeRange(since, until)

	// Use parameterized query — safe from injection
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
			rows.Scan(&dc.Domain, &dc.Count)
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
			rows2.Scan(&cc.ClientIP, &cc.Hostname, &cc.Count)
			s.TopClients = append(s.TopClients, cc)
		}
	}

	// Time bucket query with dynamic granularity
	var timeFmt string
	switch groupBy {
	case "month":
		timeFmt = "%Y-%m-01T00:00:00Z"
	case "day":
		timeFmt = "%Y-%m-%dT00:00:00Z"
	default: // hour
		timeFmt = "%Y-%m-%dT%H:00:00Z"
	}

	// Use fmt.Sprintf only for the time format string (not user input)
	timeQuery := fmt.Sprintf(`SELECT strftime('%s', timestamp) as period,
		COUNT(*) as total,
		SUM(CASE WHEN blocked THEN 1 ELSE 0 END) as blocked,
		AVG(duration_ms) as avg_dur
		FROM query_logs
		WHERE timestamp >= ? AND timestamp <= ?
		GROUP BY period ORDER BY period`, timeFmt)

	rows3, err := d.db.Query(timeQuery, sinceTs, untilTs)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var tb TimeBucket
			rows3.Scan(&tb.Hour, &tb.Total, &tb.Blocked, &tb.AvgDuration)
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

	// Top blocked domains
	rows5, err := d.db.Query(`
		SELECT domain, COUNT(*) as cnt FROM query_logs
		WHERE blocked = 1 AND timestamp >= ? AND timestamp <= ?
		GROUP BY domain ORDER BY cnt DESC LIMIT 10
	`, sinceTs, untilTs)
	if err == nil {
		defer rows5.Close()
		for rows5.Next() {
			var dc DomainCount
			rows5.Scan(&dc.Domain, &dc.Count)
			s.TopBlockedDomains = append(s.TopBlockedDomains, dc)
		}
	}

	// Query type distribution
	rows6, err := d.db.Query(`
		SELECT query_type, COUNT(*) as cnt FROM query_logs
		WHERE timestamp >= ? AND timestamp <= ?
		GROUP BY query_type ORDER BY cnt DESC
	`, sinceTs, untilTs)
	if err == nil {
		defer rows6.Close()
		for rows6.Next() {
			var tc TypeCount
			rows6.Scan(&tc.Type, &tc.Count)
			s.QueryTypes = append(s.QueryTypes, tc)
		}
	}

	return s
}

// resolveTimeRange converts since/until params into actual ISO timestamps.
// The frontend always sends ISO 8601 timestamps (from toISOString()).
// Only the defaults (empty string) need to be resolved to real timestamps.
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
